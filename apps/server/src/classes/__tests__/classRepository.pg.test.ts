import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import {
  AgeOutOfRangeError,
  ClassNotFoundError,
  CamperNotFoundError,
  EnrolmentNotFoundError,
  EnrolmentRefusedError,
  InstructorNotFoundError,
  OverlapError,
  SessionFullError,
  SessionNotFoundError,
} from '../errors';
import {
  auditActions,
  createClassFixture,
  enrolRule,
  makeClass,
  sessionAuditData,
  sessionInput,
  type ClassFixture,
} from './pgClassFixture';

const url = process.env.DATABASE_URL;

describe.skipIf(!url)('ClassRepository on Postgres', () => {
  const pool = new pg.Pool({ connectionString: url });
  beforeAll(async () => {
    await migrate(pool);
  });
  afterAll(async () => {
    await pool.end();
  });

  let fx: ClassFixture;
  beforeEach(async () => {
    fx = await createClassFixture(pool);
  });
  afterEach(async () => {
    await fx.close();
  });

  describe('classes', () => {
    it('stores a class and reads back exactly what it created', async () => {
      const created = await makeClass(fx.repo, fx.actor, { instructorRatio: { instructors: 1, campers: 8 } });
      expect(await fx.repo.getClass(fx.orgA, created.id)).toEqual(created);
      expect(created).toMatchObject({
        name: 'Robotics',
        ageRange: { minAge: 8, maxAge: 12 },
        capacity: 5,
        instructorRatio: { instructors: 1, campers: 8 },
      });
    });

    it('reads an open-ended age range (stored as NULL) as 0 to 120', async () => {
      const created = await makeClass(fx.repo, fx.actor, { ageRange: { minAge: 0, maxAge: 120 } });
      const nulls = await pool.query('SELECT age_min, age_max FROM classes WHERE id = $1', [created.id]);
      expect(nulls.rows[0]).toEqual({ age_min: 0, age_max: 120 });
      expect((await fx.repo.getClass(fx.orgA, created.id))?.ageRange).toEqual({ minAge: 0, maxAge: 120 });
    });

    it('lists classes of the camp only, oldest first', async () => {
      const first = await makeClass(fx.repo, fx.actor, { name: 'Painting' });
      const second = await makeClass(fx.repo, fx.actor, { name: 'Robotics' });
      expect((await fx.repo.listClasses(fx.orgA)).map(c => c.id)).toEqual([first.id, second.id]);
      expect(await fx.repo.listClasses(fx.orgB)).toEqual([]);
    });

    it('returns null for an unknown or malformed class id', async () => {
      expect(await fx.repo.getClass(fx.orgA, randomUUID())).toBeNull();
      expect(await fx.repo.getClass(fx.orgA, 'not-a-uuid')).toBeNull();
    });

    it('writes class.create in the same transaction', async () => {
      await makeClass(fx.repo, fx.actor);
      expect(await auditActions(pool, fx.orgA)).toEqual(['class.create']);
    });
  });

  describe('sessions', () => {
    it('copies the class ratio onto a new session, defaults nothing else, and links instructors', async () => {
      const cls = await makeClass(fx.repo, fx.actor, { instructorRatio: { instructors: 1, campers: 8 } });
      const instructor = await fx.addPerson(fx.orgA, '1980-01-01', 'Ivy');
      const session = await fx.repo.addSession(fx.actor, cls.id, sessionInput(9, 12, { instructorIds: [instructor] }));
      expect(session).toMatchObject({
        classId: cls.id,
        className: 'Robotics',
        capacity: 5,
        seatsTaken: 0,
        waitlisted: 0,
        instructorIds: [instructor],
      });
      expect(session.instructors).toEqual([{ id: instructor, name: 'Ivy Test' }]);
      expect(await sessionAuditData(pool, fx.orgA)).toMatchObject({ instructorIds: [instructor] });
      const ratio = await pool.query('SELECT ratio_campers, ratio_instructors FROM sessions WHERE id = $1', [
        session.id,
      ]);
      expect(ratio.rows[0]).toEqual({ ratio_campers: 8, ratio_instructors: 1 });
    });

    it('leaves the session ratio empty when the class has none', async () => {
      const cls = await makeClass(fx.repo, fx.actor);
      const session = await fx.repo.addSession(fx.actor, cls.id, sessionInput(9, 12));
      const ratio = await pool.query('SELECT ratio_campers, ratio_instructors FROM sessions WHERE id = $1', [
        session.id,
      ]);
      expect(ratio.rows[0]).toEqual({ ratio_campers: null, ratio_instructors: null });
    });

    it('refuses an instructor who is not a person in this camp', async () => {
      const cls = await makeClass(fx.repo, fx.actor);
      const foreign = await fx.addPerson(fx.orgB, '1980-01-01', 'Other');
      await expect(
        fx.repo.addSession(fx.actor, cls.id, sessionInput(9, 12, { instructorIds: [foreign] })),
      ).rejects.toMatchObject({ kind: 'instructor-not-found' });
      await expect(
        fx.repo.addSession(fx.actor, cls.id, sessionInput(9, 12, { instructorIds: [randomUUID()] })),
      ).rejects.toBeInstanceOf(InstructorNotFoundError);
      expect(await fx.repo.listSessions(fx.orgA, cls.id)).toEqual([]);
    });

    it('refuses a session for a class that is not in the camp, and writes nothing', async () => {
      const cls = await makeClass(fx.repo, fx.actor);
      await expect(fx.repo.addSession(fx.otherActor, cls.id, sessionInput(9, 12))).rejects.toBeInstanceOf(
        ClassNotFoundError,
      );
      expect(await auditActions(pool, fx.orgB)).toEqual([]);
    });

    it('lists the sessions of a class by start time, with seats and waitlist counts', async () => {
      const cls = await makeClass(fx.repo, fx.actor, { capacity: 1 });
      const late = await fx.repo.addSession(fx.actor, cls.id, sessionInput(13, 15));
      const early = await fx.repo.addSession(fx.actor, cls.id, sessionInput(9, 11, { capacity: 1 }));
      const camper = await fx.addPerson(fx.orgA, '2016-01-01');
      const waiting = await fx.addPerson(fx.orgA, '2016-01-01', 'Waiter');
      await fx.repo.enrol(fx.actor, { sessionId: early.id, camperId: camper }, enrolRule());
      await fx.repo.enrol(fx.actor, { sessionId: early.id, camperId: waiting }, enrolRule({ waitlistIfFull: true }));
      const listed = await fx.repo.listSessions(fx.orgA, cls.id);
      expect(listed.map(s => s.id)).toEqual([early.id, late.id]);
      expect(listed[0]).toMatchObject({ seatsTaken: 1, waitlisted: 1 });
    });

    it('lists sessions of an unknown class as not found', async () => {
      await expect(fx.repo.listSessions(fx.orgA, randomUUID())).rejects.toBeInstanceOf(ClassNotFoundError);
    });
  });

  describe('enrolment', () => {
    let classId: string;
    let sessionId: string;
    let camper: string;

    beforeEach(async () => {
      classId = (await makeClass(fx.repo, fx.actor, { capacity: 2 })).id;
      sessionId = (await fx.repo.addSession(fx.actor, classId, sessionInput(9, 12, { capacity: 2 }))).id;
      camper = await fx.addPerson(fx.orgA, '2016-03-01', 'Ada');
    });

    it('enrols a camper in range and returns the enrolment with the names', async () => {
      const enrolment = await fx.repo.enrol(fx.actor, { sessionId, camperId: camper }, enrolRule());
      expect(enrolment).toMatchObject({
        sessionId,
        classId,
        className: 'Robotics',
        camperId: camper,
        camperName: 'Ada Test',
        status: 'enrolled',
        overrideReason: null,
      });
      expect(await fx.repo.listEnrolments(fx.orgA, sessionId)).toEqual([enrolment]);
      expect((await fx.repo.listSessions(fx.orgA, classId))[0].seatsTaken).toBe(1);
    });

    it('writes enrolment.create on success', async () => {
      await fx.repo.enrol(fx.actor, { sessionId, camperId: camper }, enrolRule());
      expect(await auditActions(pool, fx.orgA)).toEqual(['class.create', 'session.create', 'enrolment.create']);
    });

    it('refuses a camper outside the age range, and writes nothing', async () => {
      const tooYoung = await fx.addPerson(fx.orgA, '2019-07-06', 'Tiny');
      await expect(fx.repo.enrol(fx.actor, { sessionId, camperId: tooYoung }, enrolRule())).rejects.toBeInstanceOf(
        AgeOutOfRangeError,
      );
      expect(await fx.repo.listEnrolments(fx.orgA, sessionId)).toEqual([]);
      expect(await auditActions(pool, fx.orgA)).not.toContain('enrolment.create');
    });

    it('refuses a camper whose date of birth is unknown', async () => {
      const unknown = await fx.addPerson(fx.orgA, null, 'Nodob');
      await expect(fx.repo.enrol(fx.actor, { sessionId, camperId: unknown }, enrolRule())).rejects.toMatchObject({
        kind: 'enrolment-refused',
      });
    });

    it('refuses a full session, and waitlists when asked', async () => {
      await fx.repo.enrol(fx.actor, { sessionId, camperId: camper }, enrolRule());
      await fx.repo.enrol(
        fx.actor,
        { sessionId, camperId: await fx.addPerson(fx.orgA, '2016-03-01', 'Ben') },
        enrolRule(),
      );
      const third = await fx.addPerson(fx.orgA, '2016-03-01', 'Cy');
      await expect(fx.repo.enrol(fx.actor, { sessionId, camperId: third }, enrolRule())).rejects.toBeInstanceOf(
        SessionFullError,
      );
      const waitlisted = await fx.repo.enrol(
        fx.actor,
        { sessionId, camperId: third },
        enrolRule({ waitlistIfFull: true }),
      );
      expect(waitlisted.status).toBe('waitlisted');
      expect((await fx.repo.listSessions(fx.orgA, classId))[0]).toMatchObject({ seatsTaken: 2, waitlisted: 1 });
    });

    it('refuses an overlap with the clashing class, and names it', async () => {
      const painting = await makeClass(fx.repo, fx.actor, { name: 'Painting' });
      const clash = await fx.repo.addSession(fx.actor, painting.id, sessionInput(11, 13));
      await fx.repo.enrol(fx.actor, { sessionId: clash.id, camperId: camper }, enrolRule());
      const error: unknown = await fx.repo
        .enrol(fx.actor, { sessionId, camperId: camper }, enrolRule())
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(OverlapError);
      if (!(error instanceof OverlapError)) {
        throw new Error('expected an OverlapError');
      }
      expect(error.refusal).toMatchObject({ reason: 'overlap', clash: { sessionId: clash.id, className: 'Painting' } });
    });

    it('treats sessions that only touch as not overlapping', async () => {
      const afternoon = await fx.repo.addSession(fx.actor, classId, sessionInput(12, 14));
      await fx.repo.enrol(fx.actor, { sessionId, camperId: camper }, enrolRule());
      await expect(
        fx.repo.enrol(fx.actor, { sessionId: afternoon.id, camperId: camper }, enrolRule()),
      ).resolves.toMatchObject({ status: 'enrolled' });
    });

    it('refuses a second enrolment in the same session, even with an override', async () => {
      await fx.repo.enrol(fx.actor, { sessionId, camperId: camper }, enrolRule());
      await expect(
        fx.repo.enrol(
          fx.actor,
          { sessionId, camperId: camper },
          enrolRule({
            override: { reason: 'Parent asked' },
            actorCanOverride: true,
          }),
        ),
      ).rejects.toBeInstanceOf(OverlapError);
    });

    it('lets an admin override an overlap with a reason, recording the reason and the clash', async () => {
      const painting = await makeClass(fx.repo, fx.actor, { name: 'Painting' });
      const clash = await fx.repo.addSession(fx.actor, painting.id, sessionInput(11, 13));
      await fx.repo.enrol(fx.actor, { sessionId: clash.id, camperId: camper }, enrolRule());
      const enrolment = await fx.repo.enrol(
        fx.actor,
        { sessionId, camperId: camper },
        enrolRule({
          override: { reason: 'Swapping with Painting next week' },
          actorCanOverride: true,
        }),
      );
      expect(enrolment.overrideReason).toBe('Swapping with Painting next week');
      const row = await pool.query('SELECT overridden, override_reason FROM enrolments WHERE id = $1', [enrolment.id]);
      expect(row.rows[0]).toEqual({ overridden: true, override_reason: 'Swapping with Painting next week' });
      expect((await auditActions(pool, fx.orgA)).slice(-2)).toEqual(['enrolment.create', 'enrolment.override']);
    });

    it('refuses an override from someone who may not give one, and writes nothing', async () => {
      const painting = await makeClass(fx.repo, fx.actor, { name: 'Painting' });
      const clash = await fx.repo.addSession(fx.actor, painting.id, sessionInput(11, 13));
      await fx.repo.enrol(fx.actor, { sessionId: clash.id, camperId: camper }, enrolRule());
      await expect(
        fx.repo.enrol(
          fx.actor,
          { sessionId, camperId: camper },
          enrolRule({
            override: { reason: 'Please' },
            actorCanOverride: false,
          }),
        ),
      ).rejects.toBeInstanceOf(EnrolmentRefusedError);
      expect(await fx.repo.listEnrolments(fx.orgA, sessionId)).toEqual([]);
    });

    it('does not let a cancelled enrolment block the same time', async () => {
      const first = await fx.repo.enrol(fx.actor, { sessionId, camperId: camper }, enrolRule());
      await fx.repo.cancelEnrolment(fx.actor, first.id, null);
      await expect(fx.repo.enrol(fx.actor, { sessionId, camperId: camper }, enrolRule())).resolves.toMatchObject({
        status: 'enrolled',
      });
    });

    it('refuses an unknown session or camper', async () => {
      await expect(
        fx.repo.enrol(fx.actor, { sessionId: randomUUID(), camperId: camper }, enrolRule()),
      ).rejects.toBeInstanceOf(SessionNotFoundError);
      await expect(fx.repo.enrol(fx.actor, { sessionId, camperId: randomUUID() }, enrolRule())).rejects.toBeInstanceOf(
        CamperNotFoundError,
      );
      await expect(
        fx.repo.enrol(fx.actor, { sessionId: 'nope', camperId: camper }, enrolRule()),
      ).rejects.toBeInstanceOf(SessionNotFoundError);
    });

    it('lists enrolments of an unknown session as not found', async () => {
      await expect(fx.repo.listEnrolments(fx.orgA, randomUUID())).rejects.toBeInstanceOf(SessionNotFoundError);
    });
  });

  describe('cancelling', () => {
    it('frees the seat, keeps the row, and writes enrolment.cancel with its note', async () => {
      const cls = await makeClass(fx.repo, fx.actor, { capacity: 1 });
      const session = await fx.repo.addSession(fx.actor, cls.id, sessionInput(9, 12, { capacity: 1 }));
      const camper = await fx.addPerson(fx.orgA, '2016-03-01');
      const enrolment = await fx.repo.enrol(fx.actor, { sessionId: session.id, camperId: camper }, enrolRule());
      const cancelled = await fx.repo.cancelEnrolment(fx.actor, enrolment.id, 'Moved to another camp');
      expect(cancelled).toMatchObject({ id: enrolment.id, status: 'cancelled' });
      expect((await fx.repo.listSessions(fx.orgA, cls.id))[0].seatsTaken).toBe(0);
      expect(await fx.repo.listEnrolments(fx.orgA, session.id)).toHaveLength(1);
      expect(await auditActions(pool, fx.orgA)).toContain('enrolment.cancel');
    });

    it('is not found when already cancelled, malformed, or in another camp', async () => {
      const cls = await makeClass(fx.repo, fx.actor);
      const session = await fx.repo.addSession(fx.actor, cls.id, sessionInput(9, 12));
      const camper = await fx.addPerson(fx.orgA, '2016-03-01');
      const enrolment = await fx.repo.enrol(fx.actor, { sessionId: session.id, camperId: camper }, enrolRule());
      await fx.repo.cancelEnrolment(fx.actor, enrolment.id, null);
      await expect(fx.repo.cancelEnrolment(fx.actor, enrolment.id, null)).rejects.toBeInstanceOf(
        EnrolmentNotFoundError,
      );
      await expect(fx.repo.cancelEnrolment(fx.actor, 'nope', null)).rejects.toBeInstanceOf(EnrolmentNotFoundError);
      await expect(fx.repo.cancelEnrolment(fx.otherActor, enrolment.id, null)).rejects.toBeInstanceOf(
        EnrolmentNotFoundError,
      );
    });
  });
});
