import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import {
  AgeOutOfRangeError,
  CapacityBelowEnrolledError,
  CamperNotFoundError,
  ClassHasEnrolmentsError,
  ClassNotFoundError,
  EnrolmentNotFoundError,
  EnrolmentRefusedError,
  InstructorNotFoundError,
  OverlapError,
  SessionFullError,
  SessionNotFoundError,
} from '../errors';
import {
  auditActions,
  classAuditData,
  createClassFixture,
  enrolRule,
  makeSession,
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

  describe('sessions (the date range)', () => {
    it('stores a session and reads back exactly what it created', async () => {
      const created = await makeSession(fx.repo, fx.actor);
      expect(await fx.repo.getSession(fx.actor.userId, fx.orgA, created.id)).toEqual(created);
      expect(created.name).toMatch(/^Summer camp \d+$/);
      expect(created).toMatchObject({
        startsOn: '2027-07-01',
        endsOn: '2027-07-31',
        classCount: 0,
      });
    });

    it('lists sessions of the camp only, by first day', async () => {
      const late = await makeSession(fx.repo, fx.actor, {
        name: 'August',
        startsOn: '2027-08-01',
        endsOn: '2027-08-14',
      });
      const early = await makeSession(fx.repo, fx.actor, { name: 'July' });
      expect((await fx.repo.listSessions(fx.actor.userId, fx.orgA)).map(s => s.id)).toEqual([early.id, late.id]);
      expect(await fx.repo.listSessions(fx.otherActor.userId, fx.orgB)).toEqual([]);
    });

    it('writes session.create in the same transaction', async () => {
      await makeSession(fx.repo, fx.actor);
      expect(await auditActions(pool, fx.orgA)).toEqual(['session.create', 'session.publish']);
    });
  });

  describe('classes (the time range)', () => {
    it('stores a class with its own name, ages, camp size and location, and reads them back', async () => {
      const session = await makeSession(fx.repo, fx.actor);
      const cls = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12, { capacity: 7 }));
      expect(await fx.repo.getClass(fx.actor.userId, fx.orgA, cls.id)).toEqual(cls);
      expect(cls).toMatchObject({
        sessionId: session.id,
        sessionName: session.name,
        name: 'Robotics',
        ageRange: { minAge: 8, maxAge: 12 },
        capacity: 7,
        seatsTaken: 0,
        waitlisted: 0,
      });
      expect(await classAuditData(pool, fx.orgA)).toMatchObject({ sessionId: session.id });
    });

    it('reads an open-ended age range (stored as NULL) as 0 to 120', async () => {
      const session = await makeSession(fx.repo, fx.actor);
      const cls = await fx.repo.addClass(
        fx.actor,
        session.id,
        sessionInput(9, 12, { ageRange: { minAge: 0, maxAge: 120 } }),
      );
      const nulls = await pool.query('SELECT age_min, age_max FROM sessions WHERE id = $1', [cls.id]);
      expect(nulls.rows[0]).toEqual({ age_min: 0, age_max: 120 });
      expect((await fx.repo.getClass(fx.actor.userId, fx.orgA, cls.id))?.ageRange).toEqual({ minAge: 0, maxAge: 120 });
    });

    it('lists the classes of a session by start time, with seats and waitlist counts', async () => {
      const session = await makeSession(fx.repo, fx.actor);
      const late = await fx.repo.addClass(fx.actor, session.id, sessionInput(13, 15));
      const early = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 11, { capacity: 1 }));
      const camper = await fx.addPerson(fx.orgA, '2016-01-01');
      const waiting = await fx.addPerson(fx.orgA, '2016-01-01', 'Waiter');
      await fx.repo.enrol(fx.actor, { classId: early.id, camperId: camper }, enrolRule());
      await fx.repo.enrol(fx.actor, { classId: early.id, camperId: waiting }, enrolRule({ waitlistIfFull: true }));
      const listed = await fx.repo.listClasses(fx.actor.userId, fx.orgA, session.id);
      expect(listed.map(c => c.id)).toEqual([early.id, late.id]);
      expect(listed[0]).toMatchObject({ seatsTaken: 1, waitlisted: 1 });
      expect((await fx.repo.getSession(fx.actor.userId, fx.orgA, session.id))?.classCount).toBe(2);
    });

    it('widens the session dates to cover a class written on a later day, and never shrinks them', async () => {
      const session = await makeSession(fx.repo, fx.actor, { startsOn: '2027-07-05', endsOn: '2027-07-06' });
      await fx.repo.addClass(fx.actor, session.id, {
        ...sessionInput(9, 12),
        startsAt: '2027-07-07T09:00:00+10:00',
        endsAt: '2027-07-07T12:00:00+10:00',
      });
      expect(await fx.repo.getSession(fx.actor.userId, fx.orgA, session.id)).toMatchObject({
        startsOn: '2027-07-05',
        endsOn: '2027-07-07',
      });
    });

    it('lists the classes of an unknown session as not found', async () => {
      await expect(fx.repo.listClasses(fx.actor.userId, fx.orgA, randomUUID())).rejects.toBeInstanceOf(
        SessionNotFoundError,
      );
    });

    it('refuses an instructor who is not a person in this camp, and writes nothing', async () => {
      const session = await makeSession(fx.repo, fx.actor);
      const foreign = await fx.addPerson(fx.orgB, '1980-01-01', 'Other');
      await expect(
        fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12, { instructorIds: [foreign] })),
      ).rejects.toBeInstanceOf(InstructorNotFoundError);
      await expect(
        fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12, { instructorIds: [randomUUID()] })),
      ).rejects.toBeInstanceOf(InstructorNotFoundError);
      expect(await fx.repo.listClasses(fx.actor.userId, fx.orgA, session.id)).toEqual([]);
    });

    it('refuses a class for a session that is not in the camp, and writes nothing', async () => {
      const session = await makeSession(fx.repo, fx.actor);
      await expect(fx.repo.addClass(fx.otherActor, session.id, sessionInput(9, 12))).rejects.toBeInstanceOf(
        SessionNotFoundError,
      );
      expect(await auditActions(pool, fx.orgB)).toEqual([]);
    });

    it('updates a class and replaces its instructors, and audits the update', async () => {
      const session = await makeSession(fx.repo, fx.actor);
      const first = await fx.addPerson(fx.orgA, '1980-01-01', 'Ivy');
      const second = await fx.addPerson(fx.orgA, '1981-01-01', 'Omar');
      const cls = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12, { instructorIds: [first] }));
      const updated = await fx.repo.updateClass(
        fx.actor,
        cls.id,
        sessionInput(13, 15, { name: 'Painting', capacity: 8, instructorIds: [second] }),
      );
      expect(updated).toMatchObject({
        name: 'Painting',
        capacity: 8,
        location: 'Lab 1',
        startsAt: '2027-07-05T03:00:00.000Z',
        instructorIds: [second],
        price: null,
      });
      const links = await pool.query<{ person_id: string }>(
        'SELECT person_id FROM session_instructors WHERE session_id = $1',
        [cls.id],
      );
      expect(links.rows.map(r => r.person_id)).toEqual([second]);
      expect(await auditActions(pool, fx.orgA)).toContain('class.update');
    });

    it('refuses an edit that takes the camp size below the places taken, and changes nothing', async () => {
      const session = await makeSession(fx.repo, fx.actor);
      const cls = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12, { capacity: 3 }));
      await fx.repo.enrol(
        fx.actor,
        { classId: cls.id, camperId: await fx.addPerson(fx.orgA, '2016-03-01') },
        enrolRule(),
      );
      await fx.repo.enrol(
        fx.actor,
        { classId: cls.id, camperId: await fx.addPerson(fx.orgA, '2016-03-01') },
        enrolRule(),
      );
      await expect(fx.repo.updateClass(fx.actor, cls.id, sessionInput(9, 12, { capacity: 1 }))).rejects.toBeInstanceOf(
        CapacityBelowEnrolledError,
      );
      expect((await fx.repo.getClass(fx.actor.userId, fx.orgA, cls.id))?.capacity).toBe(3);
    });

    it('an edit of a class that is not in the camp is not found', async () => {
      await expect(fx.repo.updateClass(fx.otherActor, randomUUID(), sessionInput(9, 12))).rejects.toBeInstanceOf(
        ClassNotFoundError,
      );
    });

    it('deletes a class with no enrolments, and audits the delete', async () => {
      const session = await makeSession(fx.repo, fx.actor);
      const cls = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12));
      await fx.repo.deleteClass(fx.actor, cls.id);
      expect(await fx.repo.getClass(fx.actor.userId, fx.orgA, cls.id)).toBeNull();
      expect(await auditActions(pool, fx.orgA)).toContain('class.delete');
    });

    it('refuses to delete a class with an enrolment, even a cancelled one, and removes nothing', async () => {
      const session = await makeSession(fx.repo, fx.actor);
      const cls = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12));
      const enrolment = await fx.repo.enrol(
        fx.actor,
        { classId: cls.id, camperId: await fx.addPerson(fx.orgA, '2016-03-01') },
        enrolRule(),
      );
      await fx.repo.cancelEnrolment(fx.actor, enrolment.id, null);
      await expect(fx.repo.deleteClass(fx.actor, cls.id)).rejects.toBeInstanceOf(ClassHasEnrolmentsError);
      expect(await fx.repo.getClass(fx.actor.userId, fx.orgA, cls.id)).not.toBeNull();
    });

    it('deleting a class of another camp is not found', async () => {
      const session = await makeSession(fx.repo, fx.actor);
      const cls = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12));
      await expect(fx.repo.deleteClass(fx.otherActor, cls.id)).rejects.toBeInstanceOf(ClassNotFoundError);
      expect(await fx.repo.getClass(fx.actor.userId, fx.orgA, cls.id)).not.toBeNull();
    });
  });

  describe('enrolment', () => {
    let classId: string;
    let camper: string;

    beforeEach(async () => {
      const session = await makeSession(fx.repo, fx.actor);
      classId = (await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12, { capacity: 2 }))).id;
      camper = await fx.addPerson(fx.orgA, '2016-03-01', 'Ada');
    });

    it('enrols a camper in range and returns the enrolment with the names', async () => {
      const enrolment = await fx.repo.enrol(fx.actor, { classId, camperId: camper }, enrolRule());
      expect(enrolment).toMatchObject({
        classId,
        className: 'Robotics',
        camperId: camper,
        camperName: 'Ada Test',
        status: 'enrolled',
        overrideReason: null,
      });
      expect(await fx.repo.listEnrolments(fx.actor.userId, fx.orgA, classId)).toEqual([enrolment]);
      expect((await fx.repo.getClass(fx.actor.userId, fx.orgA, classId))?.seatsTaken).toBe(1);
    });

    it('writes enrolment.create on success', async () => {
      await fx.repo.enrol(fx.actor, { classId, camperId: camper }, enrolRule());
      expect(await auditActions(pool, fx.orgA)).toEqual([
        'session.create',
        'session.publish',
        'class.create',
        'enrolment.create',
      ]);
    });

    it('refuses a camper outside the age range, and writes nothing', async () => {
      const tooYoung = await fx.addPerson(fx.orgA, '2019-07-06', 'Tiny');
      await expect(fx.repo.enrol(fx.actor, { classId, camperId: tooYoung }, enrolRule())).rejects.toBeInstanceOf(
        AgeOutOfRangeError,
      );
      expect(await fx.repo.listEnrolments(fx.actor.userId, fx.orgA, classId)).toEqual([]);
      expect(await auditActions(pool, fx.orgA)).not.toContain('enrolment.create');
    });

    it('refuses a camper whose date of birth is unknown', async () => {
      const unknown = await fx.addPerson(fx.orgA, null, 'Nodob');
      await expect(fx.repo.enrol(fx.actor, { classId, camperId: unknown }, enrolRule())).rejects.toBeInstanceOf(
        EnrolmentRefusedError,
      );
    });

    it('refuses a full class, and waitlists when asked', async () => {
      await fx.repo.enrol(fx.actor, { classId, camperId: camper }, enrolRule());
      await fx.repo.enrol(
        fx.actor,
        { classId, camperId: await fx.addPerson(fx.orgA, '2016-03-01', 'Ben') },
        enrolRule(),
      );
      const third = await fx.addPerson(fx.orgA, '2016-03-01', 'Cy');
      await expect(fx.repo.enrol(fx.actor, { classId, camperId: third }, enrolRule())).rejects.toBeInstanceOf(
        SessionFullError,
      );
      const waitlisted = await fx.repo.enrol(
        fx.actor,
        { classId, camperId: third },
        enrolRule({ waitlistIfFull: true }),
      );
      expect(waitlisted.status).toBe('waitlisted');
      const cls = await fx.repo.getClass(fx.actor.userId, fx.orgA, classId);
      expect(cls).toMatchObject({ seatsTaken: 2, waitlisted: 1 });
    });

    it('refuses an overlap with the clashing class, and names it', async () => {
      const session = await makeSession(fx.repo, fx.actor);
      const clash = await fx.repo.addClass(fx.actor, session.id, sessionInput(11, 13, { name: 'Painting' }));
      await fx.repo.enrol(fx.actor, { classId: clash.id, camperId: camper }, enrolRule());
      const error: unknown = await fx.repo
        .enrol(fx.actor, { classId, camperId: camper }, enrolRule())
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(OverlapError);
      if (!(error instanceof OverlapError)) {
        throw new Error('expected an OverlapError');
      }
      expect(error.refusal).toMatchObject({ reason: 'overlap', clash: { sessionId: clash.id, className: 'Painting' } });
    });

    it('treats classes that only touch as not overlapping', async () => {
      const session = await makeSession(fx.repo, fx.actor);
      const afternoon = await fx.repo.addClass(fx.actor, session.id, sessionInput(12, 14));
      await fx.repo.enrol(fx.actor, { classId, camperId: camper }, enrolRule());
      await expect(
        fx.repo.enrol(fx.actor, { classId: afternoon.id, camperId: camper }, enrolRule()),
      ).resolves.toMatchObject({
        status: 'enrolled',
      });
    });

    it('refuses a second enrolment in the same class, even with an override', async () => {
      await fx.repo.enrol(fx.actor, { classId, camperId: camper }, enrolRule());
      await expect(
        fx.repo.enrol(
          fx.actor,
          { classId, camperId: camper },
          enrolRule({ override: { reason: 'Parent asked' }, actorCanOverride: true }),
        ),
      ).rejects.toBeInstanceOf(OverlapError);
    });

    it('lets an admin override an overlap with a reason, recording the reason and the clash', async () => {
      const session = await makeSession(fx.repo, fx.actor);
      const clash = await fx.repo.addClass(fx.actor, session.id, sessionInput(11, 13, { name: 'Painting' }));
      await fx.repo.enrol(fx.actor, { classId: clash.id, camperId: camper }, enrolRule());
      const enrolment = await fx.repo.enrol(
        fx.actor,
        { classId, camperId: camper },
        enrolRule({ override: { reason: 'Swapping with Painting next week' }, actorCanOverride: true }),
      );
      expect(enrolment.overrideReason).toBe('Swapping with Painting next week');
      const row = await pool.query('SELECT overridden, override_reason FROM enrolments WHERE id = $1', [enrolment.id]);
      expect(row.rows[0]).toEqual({ overridden: true, override_reason: 'Swapping with Painting next week' });
      expect((await auditActions(pool, fx.orgA)).slice(-2)).toEqual(['enrolment.create', 'enrolment.override']);
    });

    it('refuses an override from someone who may not give one, and writes nothing', async () => {
      const session = await makeSession(fx.repo, fx.actor);
      const clash = await fx.repo.addClass(fx.actor, session.id, sessionInput(11, 13, { name: 'Painting' }));
      await fx.repo.enrol(fx.actor, { classId: clash.id, camperId: camper }, enrolRule());
      await expect(
        fx.repo.enrol(
          fx.actor,
          { classId, camperId: camper },
          enrolRule({ override: { reason: 'Please' }, actorCanOverride: false }),
        ),
      ).rejects.toBeInstanceOf(EnrolmentRefusedError);
      expect(await fx.repo.listEnrolments(fx.actor.userId, fx.orgA, classId)).toEqual([]);
    });

    it('does not let a cancelled enrolment block the same time', async () => {
      const first = await fx.repo.enrol(fx.actor, { classId, camperId: camper }, enrolRule());
      await fx.repo.cancelEnrolment(fx.actor, first.id, null);
      await expect(fx.repo.enrol(fx.actor, { classId, camperId: camper }, enrolRule())).resolves.toMatchObject({
        status: 'enrolled',
      });
    });

    it('refuses an unknown class or camper', async () => {
      await expect(
        fx.repo.enrol(fx.actor, { classId: randomUUID(), camperId: camper }, enrolRule()),
      ).rejects.toBeInstanceOf(ClassNotFoundError);
      await expect(fx.repo.enrol(fx.actor, { classId, camperId: randomUUID() }, enrolRule())).rejects.toBeInstanceOf(
        CamperNotFoundError,
      );
      await expect(fx.repo.enrol(fx.actor, { classId: 'nope', camperId: camper }, enrolRule())).rejects.toBeInstanceOf(
        ClassNotFoundError,
      );
    });

    it('lists enrolments of an unknown class as not found', async () => {
      await expect(fx.repo.listEnrolments(fx.actor.userId, fx.orgA, randomUUID())).rejects.toBeInstanceOf(
        ClassNotFoundError,
      );
    });
  });

  describe('cancelling', () => {
    it('frees the seat, keeps the row, and writes enrolment.cancel with its note', async () => {
      const session = await makeSession(fx.repo, fx.actor);
      const cls = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12, { capacity: 1 }));
      const camper = await fx.addPerson(fx.orgA, '2016-03-01');
      const enrolment = await fx.repo.enrol(fx.actor, { classId: cls.id, camperId: camper }, enrolRule());
      const cancelled = await fx.repo.cancelEnrolment(fx.actor, enrolment.id, 'Moved to another camp');
      expect(cancelled).toMatchObject({ id: enrolment.id, status: 'cancelled' });
      expect((await fx.repo.getClass(fx.actor.userId, fx.orgA, cls.id))?.seatsTaken).toBe(0);
      expect(await fx.repo.listEnrolments(fx.actor.userId, fx.orgA, cls.id)).toHaveLength(1);
      expect(await auditActions(pool, fx.orgA)).toContain('enrolment.cancel');
    });

    it('is not found when already cancelled, malformed, or in another camp', async () => {
      const session = await makeSession(fx.repo, fx.actor);
      const cls = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12));
      const camper = await fx.addPerson(fx.orgA, '2016-03-01');
      const enrolment = await fx.repo.enrol(fx.actor, { classId: cls.id, camperId: camper }, enrolRule());
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
