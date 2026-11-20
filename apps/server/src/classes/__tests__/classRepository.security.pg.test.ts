import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import { CamperNotFoundError, ClassNotFoundError, EnrolmentNotFoundError, SessionNotFoundError } from '../errors';
import { createClassFixture, enrolRule, makeSession, sessionInput, type ClassFixture } from './pgClassFixture';

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
  /** The session (the date range) in camp A. */
  let parentId: string;
  /** The class (the time range) in camp A. */
  let classId: string;
  let enrolmentId: string;
  let instructorId: string;

  beforeEach(async () => {
    fx = await createClassFixture(pool);
    instructorId = await fx.addPerson(fx.orgA, '1980-01-01', 'Ivy');
    parentId = (await makeSession(fx.repo, fx.actor)).id;
    classId = (await fx.repo.addClass(fx.actor, parentId, sessionInput(9, 12, { instructorIds: [instructorId] }))).id;
    const camper = await fx.addPerson(fx.orgA, '2016-03-01', 'Ada');
    enrolmentId = (await fx.repo.enrol(fx.actor, { classId, camperId: camper }, enrolRule())).id;
  });
  afterEach(async () => {
    await fx.close();
  });

  /** Runs one statement as the request role, in camp A. Returns the rejection, so a test can check its SQLSTATE. */
  const asCampA = (sql: string, params: unknown[]) =>
    withOrg(pool, fx.actor.userId, fx.orgA, db => db.query(sql, params));

  describe('the request role cannot hard-delete', () => {
    it.each([
      ['classes', 'DELETE FROM classes WHERE id = $1', () => parentId],
      ['sessions', 'DELETE FROM sessions WHERE id = $1', () => classId],
      ['enrolments', 'DELETE FROM enrolments WHERE id = $1', () => enrolmentId],
      ['session_instructors', 'DELETE FROM session_instructors WHERE session_id = $1', () => classId],
    ])('DELETE on %s is refused with insufficient privilege', async (_table, sql, id) => {
      await expect(asCampA(sql, [id()])).rejects.toMatchObject({ code: '42501' });
    });

    it('the rows are still there after the refused deletes', async () => {
      await expect(asCampA('DELETE FROM enrolments WHERE id = $1', [enrolmentId])).rejects.toMatchObject({
        code: '42501',
      });
      const { rows } = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM enrolments WHERE id = $1', [
        enrolmentId,
      ]);
      expect(rows[0].n).toBe(1);
    });
  });

  describe('a second camp sees none of it', () => {
    it('lists no sessions, and reads no session, class or enrolment by id', async () => {
      expect(await fx.repo.listSessions(fx.otherActor.userId, fx.orgB)).toEqual([]);
      expect(await fx.repo.getSession(fx.otherActor.userId, fx.orgB, parentId)).toBeNull();
      expect(await fx.repo.getClass(fx.otherActor.userId, fx.orgB, classId)).toBeNull();
      await expect(fx.repo.listClasses(fx.otherActor.userId, fx.orgB, parentId)).rejects.toBeInstanceOf(
        SessionNotFoundError,
      );
      await expect(fx.repo.listEnrolments(fx.otherActor.userId, fx.orgB, classId)).rejects.toBeInstanceOf(
        ClassNotFoundError,
      );
    });

    it('sees no rows at all in the tables under its own role', async () => {
      for (const table of ['classes', 'sessions', 'enrolments', 'session_instructors']) {
        const n = await withOrg(
          pool,
          fx.otherActor.userId,
          fx.orgB,
          async db => (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,
        );
        expect(n, table).toBe(0);
      }
    });

    it('cannot cancel an enrolment in camp A', async () => {
      await expect(fx.repo.cancelEnrolment(fx.otherActor, enrolmentId, null)).rejects.toBeInstanceOf(
        EnrolmentNotFoundError,
      );
      const { rows } = await pool.query<{ status: string }>('SELECT status FROM enrolments WHERE id = $1', [
        enrolmentId,
      ]);
      expect(rows[0].status).toBe('enrolled');
    });

    it('cannot enrol into a class in camp A, or with a camper from camp A', async () => {
      const campB = await fx.addPerson(fx.orgB, '2016-03-01', 'Bo');
      await expect(fx.repo.enrol(fx.otherActor, { classId, camperId: campB }, enrolRule())).rejects.toBeInstanceOf(
        ClassNotFoundError,
      );
      const campAPerson = await fx.addPerson(fx.orgA, '2016-03-01', 'Cy');
      // The camper is looked up first, so the other camp's camper reads as missing.
      await expect(
        fx.repo.enrol(fx.otherActor, { classId, camperId: campAPerson }, enrolRule()),
      ).rejects.toBeInstanceOf(CamperNotFoundError);
    });

    it('cannot add a class in camp B that uses an instructor from camp A', async () => {
      const bSession = (await makeSession(fx.repo, fx.otherActor, { name: 'Camp B summer' })).id;
      await expect(
        fx.repo.addClass(fx.otherActor, bSession, sessionInput(9, 12, { instructorIds: [instructorId] })),
      ).rejects.toMatchObject({ kind: 'instructor-not-found' });
    });

    it('cannot delete or edit a class in camp A', async () => {
      await expect(fx.repo.deleteClass(fx.otherActor, classId)).rejects.toBeInstanceOf(ClassNotFoundError);
      await expect(fx.repo.updateClass(fx.otherActor, classId, sessionInput(9, 12))).rejects.toBeInstanceOf(
        ClassNotFoundError,
      );
    });
  });
});
