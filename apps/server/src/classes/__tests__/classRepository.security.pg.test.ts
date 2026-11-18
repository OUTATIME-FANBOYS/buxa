import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import { CamperNotFoundError, ClassNotFoundError, EnrolmentNotFoundError, SessionNotFoundError } from '../errors';
import { createClassFixture, enrolRule, makeClass, sessionInput, type ClassFixture } from './pgClassFixture';

const url = process.env.DATABASE_URL;

describe.skipIf(!url)('classes on Postgres: request role and camp isolation', () => {
  const pool = new pg.Pool({ connectionString: url });
  beforeAll(async () => {
    await migrate(pool);
  });
  afterAll(async () => {
    await pool.end();
  });

  let fx: ClassFixture;
  let classId: string;
  let sessionId: string;
  let enrolmentId: string;
  let instructorId: string;

  beforeEach(async () => {
    fx = await createClassFixture(pool);
    instructorId = await fx.addPerson(fx.orgA, '1980-01-01', 'Ivy');
    classId = (await makeClass(fx.repo, fx.actor, { instructorRatio: { instructors: 1, campers: 8 } })).id;
    sessionId = (await fx.repo.addSession(fx.actor, classId, sessionInput(9, 12, { instructorIds: [instructorId] }))).id;
    const camper = await fx.addPerson(fx.orgA, '2016-03-01', 'Ada');
    enrolmentId = (await fx.repo.enrol(fx.actor, { sessionId, camperId: camper }, enrolRule())).id;
  });
  afterEach(async () => {
    await fx.close();
  });

  /** Runs one statement as the request role, in camp A. Returns the rejection, so a test can check its SQLSTATE. */
  const asCampA = (sql: string, params: unknown[]) => withOrg(pool, fx.orgA, db => db.query(sql, params));

  describe('the request role cannot hard-delete', () => {
    it.each([
      ['classes', 'DELETE FROM classes WHERE id = $1', () => classId],
      ['sessions', 'DELETE FROM sessions WHERE id = $1', () => sessionId],
      ['enrolments', 'DELETE FROM enrolments WHERE id = $1', () => enrolmentId],
      ['session_instructors', 'DELETE FROM session_instructors WHERE session_id = $1', () => sessionId],
    ])('DELETE on %s is refused with insufficient privilege', async (_table, sql, id) => {
      await expect(asCampA(sql, [id()])).rejects.toMatchObject({ code: '42501' });
    });

    it('the rows are still there after the refused deletes', async () => {
      await expect(asCampA('DELETE FROM enrolments WHERE id = $1', [enrolmentId])).rejects.toMatchObject({ code: '42501' });
      const { rows } = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM enrolments WHERE id = $1', [enrolmentId]);
      expect(rows[0].n).toBe(1);
    });
  });

  describe('a second camp sees none of it', () => {
    it('lists no classes, and reads no class, session or enrolment by id', async () => {
      expect(await fx.repo.listClasses(fx.orgB)).toEqual([]);
      expect(await fx.repo.getClass(fx.orgB, classId)).toBeNull();
      await expect(fx.repo.listSessions(fx.orgB, classId)).rejects.toBeInstanceOf(ClassNotFoundError);
      await expect(fx.repo.listEnrolments(fx.orgB, sessionId)).rejects.toBeInstanceOf(SessionNotFoundError);
    });

    it('sees no rows at all in the tables under its own role', async () => {
      for (const table of ['classes', 'sessions', 'enrolments', 'session_instructors']) {
        const n = await withOrg(pool, fx.orgB, async db => (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n);
        expect(n, table).toBe(0);
      }
    });

    it('cannot cancel an enrolment in camp A', async () => {
      await expect(fx.repo.cancelEnrolment(fx.otherActor, enrolmentId, null)).rejects.toBeInstanceOf(EnrolmentNotFoundError);
      const { rows } = await pool.query<{ status: string }>('SELECT status FROM enrolments WHERE id = $1', [enrolmentId]);
      expect(rows[0].status).toBe('enrolled');
    });

    it('cannot enrol into a session in camp A, or with a camper from camp A', async () => {
      const campB = await fx.addPerson(fx.orgB, '2016-03-01', 'Bo');
      await expect(fx.repo.enrol(fx.otherActor, { sessionId, camperId: campB }, enrolRule())).rejects.toBeInstanceOf(SessionNotFoundError);
      const campAPerson = await fx.addPerson(fx.orgA, '2016-03-01', 'Cy');
      // The camper is looked up first, so the other camp's camper reads as missing.
      await expect(fx.repo.enrol(fx.otherActor, { sessionId, camperId: campAPerson }, enrolRule())).rejects.toBeInstanceOf(CamperNotFoundError);
    });

    it('cannot link a camp-A instructor to a session in camp B', async () => {
      const bClass = (await makeClass(fx.repo, fx.otherActor, { name: 'Camp B robotics' })).id;
      await expect(fx.repo.addSession(fx.otherActor, bClass, sessionInput(9, 12, { instructorIds: [instructorId] })))
        .rejects.toMatchObject({ kind: 'instructor-not-found' });
    });
  });
});
