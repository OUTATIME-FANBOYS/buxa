import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import { holdExpiresAt, type Actor } from '@buxa/domain';
import {
  ClassNotFoundError,
  HoldExistsError,
  HoldNotFoundError,
  HouseholdNotFoundError,
  SessionFullError,
} from '../../classes/errors';
import { PgSeatHoldRepository } from '../PgSeatHoldRepository';
import {
  auditActions,
  createClassFixture,
  enrolRule,
  makeSession,
  sessionInput,
  type ClassFixture,
} from '../../classes/__tests__/pgClassFixture';

const url = process.env.DATABASE_URL;

/** A household in a camp. Holds are taken for households, so each test makes its own. */
async function addHousehold(fx: ClassFixture, orgId: string, name: string): Promise<string> {
  return withOrg(
    fx.pool,
    orgId === fx.orgB ? fx.otherActor.userId : fx.actor.userId,
    orgId,
    async db =>
      (
        await db.query<{ id: string }>(`INSERT INTO households (org_id, name) VALUES ($1, $2) RETURNING id`, [
          orgId,
          name,
        ])
      ).rows[0].id,
  );
}

/** Moves a hold's expiry into the past, as if its time had passed, without waiting for the clock. */
async function expireHoldNow(fx: ClassFixture, orgId: string, holdId: string): Promise<void> {
  await withOrg(fx.pool, orgId === fx.orgB ? fx.otherActor.userId : fx.actor.userId, orgId, db =>
    db.query(`UPDATE seat_holds SET expires_at = now() - interval '1 minute' WHERE id = $1`, [holdId]),
  );
}

/** The unreleased hold row, whether or not its time has passed. */
async function unreleasedHoldCount(fx: ClassFixture, orgId: string, sessionId: string): Promise<number> {
  return withOrg(
    fx.pool,
    orgId === fx.orgB ? fx.otherActor.userId : fx.actor.userId,
    orgId,
    async db =>
      (
        await db.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM seat_holds WHERE session_id = $1 AND released_at IS NULL`,
          [sessionId],
        )
      ).rows[0].n,
  );
}

describe.skipIf(!url)('seat holds on Postgres', () => {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  let fx: ClassFixture;
  let holds: PgSeatHoldRepository;
  let actor: Actor;

  beforeAll(async () => {
    await migrate(pool);
    fx = await createClassFixture(pool);
    holds = new PgSeatHoldRepository(pool);
    actor = fx.actor;
  });
  afterAll(async () => {
    await fx.close();
    await pool.end();
  });

  it('a hold takes one place, shows in the seat count, and a full session refuses the next one', async () => {
    const session = await makeSession(fx.repo, actor);
    const cls = await fx.repo.addClass(actor, session.id, sessionInput(9, 12, { capacity: 1 }));
    const first = await addHousehold(fx, fx.orgA, 'Hart family');
    const second = await addHousehold(fx, fx.orgA, 'Lin family');

    const hold = await holds.placeHold(actor, {
      sessionId: cls.id,
      householdId: first,
      expiresAt: holdExpiresAt(new Date()),
    });
    expect(hold.releasedAt).toBeNull();
    expect((await fx.repo.getClass(fx.actor.userId, fx.orgA, cls.id))?.seatsTaken).toBe(1);

    await expect(
      holds.placeHold(actor, { sessionId: cls.id, householdId: second, expiresAt: holdExpiresAt(new Date()) }),
    ).rejects.toBeInstanceOf(SessionFullError);
    // A full session also refuses a camper: the hold is taken from the same places.
    const camper = await fx.addPerson(fx.orgA, '2016-03-01', 'Ivy');
    await expect(fx.repo.enrol(actor, { classId: cls.id, camperId: camper }, enrolRule())).rejects.toBeInstanceOf(
      SessionFullError,
    );
  });

  it('one household holds at most one place per session, and may hold again after releasing it', async () => {
    const session = await makeSession(fx.repo, actor);
    const cls = await fx.repo.addClass(actor, session.id, sessionInput(9, 12, { capacity: 3 }));
    const household = await addHousehold(fx, fx.orgA, 'Repeat family');
    const expiresAt = holdExpiresAt(new Date());

    const hold = await holds.placeHold(actor, { sessionId: cls.id, householdId: household, expiresAt });
    await expect(
      holds.placeHold(actor, { sessionId: cls.id, householdId: household, expiresAt }),
    ).rejects.toBeInstanceOf(HoldExistsError);

    await holds.releaseHold(actor, hold.id);
    const again = await holds.placeHold(actor, { sessionId: cls.id, householdId: household, expiresAt });
    expect(again.id).not.toBe(hold.id);
  });

  it('an expired hold stops counting at once, even before the cleanup runs', async () => {
    const session = await makeSession(fx.repo, actor);
    const cls = await fx.repo.addClass(actor, session.id, sessionInput(9, 12, { capacity: 1 }));
    const household = await addHousehold(fx, fx.orgA, 'Late family');
    const hold = await holds.placeHold(actor, {
      sessionId: cls.id,
      householdId: household,
      expiresAt: holdExpiresAt(new Date()),
    });
    await expireHoldNow(fx, fx.orgA, hold.id);

    // The row is still unreleased, but its time has passed: the place is free.
    expect(await unreleasedHoldCount(fx, fx.orgA, cls.id)).toBe(1);
    expect((await fx.repo.getClass(fx.actor.userId, fx.orgA, cls.id))?.seatsTaken).toBe(0);
    const camper = await fx.addPerson(fx.orgA, '2016-03-01', 'Nell');
    const enrolment = await fx.repo.enrol(actor, { classId: cls.id, camperId: camper }, enrolRule());
    expect(enrolment.status).toBe('enrolled');
  });

  it('the cleanup releases expired holds, promotes the first waitlisted camper, and is safe to run twice', async () => {
    const session = await makeSession(fx.repo, actor);
    const cls = await fx.repo.addClass(actor, session.id, sessionInput(9, 12, { capacity: 1 }));
    const household = await addHousehold(fx, fx.orgA, 'Waiting family');
    const hold = await holds.placeHold(actor, {
      sessionId: cls.id,
      householdId: household,
      expiresAt: holdExpiresAt(new Date()),
    });
    const camper = await fx.addPerson(fx.orgA, '2016-03-01', 'Wes');
    const waiting = await fx.repo.enrol(
      actor,
      { classId: cls.id, camperId: camper },
      enrolRule({ waitlistIfFull: true }),
    );
    expect(waiting.status).toBe('waitlisted');

    // The camp is shared by this file's tests, so audit entries are compared before and after the cleanup, not in total.
    const countOf = async (action: string) => (await auditActions(pool, fx.orgA)).filter(a => a === action).length;
    const expiredBefore = await countOf('hold.expire');
    const promotedBefore = await countOf('enrolment.promote');

    await expireHoldNow(fx, fx.orgA, hold.id);
    expect(await holds.releaseExpiredHolds(fx.actor.userId, fx.orgA)).toBe(1);
    expect(await holds.releaseExpiredHolds(fx.actor.userId, fx.orgA)).toBe(0);

    const after = await fx.repo.getClass(fx.actor.userId, fx.orgA, cls.id);
    expect(after?.seatsTaken).toBe(1);
    expect(after?.waitlisted).toBe(0);
    expect((await countOf('hold.expire')) - expiredBefore).toBe(1);
    expect((await countOf('enrolment.promote')) - promotedBefore).toBe(1);
  });

  it('releasing a hold hands its place to the first waitlisted camper', async () => {
    const session = await makeSession(fx.repo, actor);
    const cls = await fx.repo.addClass(actor, session.id, sessionInput(9, 12, { capacity: 1 }));
    const household = await addHousehold(fx, fx.orgA, 'Release family');
    const hold = await holds.placeHold(actor, {
      sessionId: cls.id,
      householdId: household,
      expiresAt: holdExpiresAt(new Date()),
    });
    const camper = await fx.addPerson(fx.orgA, '2016-03-01', 'Ruth');
    await fx.repo.enrol(actor, { classId: cls.id, camperId: camper }, enrolRule({ waitlistIfFull: true }));

    const released = await holds.releaseHold(actor, hold.id);
    expect(released.releaseReason).toBe('cancelled');
    expect((await fx.repo.getClass(fx.actor.userId, fx.orgA, cls.id))?.seatsTaken).toBe(1);
    expect((await fx.repo.getClass(fx.actor.userId, fx.orgA, cls.id))?.waitlisted).toBe(0);
    await expect(holds.releaseHold(actor, hold.id)).rejects.toBeInstanceOf(HoldNotFoundError);
  });

  it('cancelling an enrolment hands its place to the first waitlisted camper, in the order they joined', async () => {
    const session = await makeSession(fx.repo, actor);
    const cls = await fx.repo.addClass(actor, session.id, sessionInput(9, 12, { capacity: 1 }));
    const first = await fx.addPerson(fx.orgA, '2016-03-01', 'Ann');
    const second = await fx.addPerson(fx.orgA, '2016-03-01', 'Bea');
    const third = await fx.addPerson(fx.orgA, '2016-03-01', 'Cy');
    const holder = await fx.repo.enrol(actor, { classId: cls.id, camperId: first }, enrolRule());
    const waitA = await fx.repo.enrol(
      actor,
      { classId: cls.id, camperId: second },
      enrolRule({ waitlistIfFull: true }),
    );
    const waitB = await fx.repo.enrol(actor, { classId: cls.id, camperId: third }, enrolRule({ waitlistIfFull: true }));

    await fx.repo.cancelEnrolment(actor, holder.id, null);
    const list = await fx.repo.listEnrolments(fx.actor.userId, fx.orgA, cls.id);
    expect(list.find(e => e.id === waitA.id)?.status).toBe('enrolled');
    expect(list.find(e => e.id === waitB.id)?.status).toBe('waitlisted');
  });

  it('cancelling a waitlisted entry frees no place, so nobody is promoted', async () => {
    const session = await makeSession(fx.repo, actor);
    const cls = await fx.repo.addClass(actor, session.id, sessionInput(9, 12, { capacity: 1 }));
    const holder = await fx.addPerson(fx.orgA, '2016-03-01', 'Dan');
    const queued = await fx.addPerson(fx.orgA, '2016-03-01', 'Eli');
    await fx.repo.enrol(actor, { classId: cls.id, camperId: holder }, enrolRule());
    const waiting = await fx.repo.enrol(
      actor,
      { classId: cls.id, camperId: queued },
      enrolRule({ waitlistIfFull: true }),
    );

    await fx.repo.cancelEnrolment(actor, waiting.id, null);
    const after = await fx.repo.getClass(fx.actor.userId, fx.orgA, cls.id);
    expect(after?.seatsTaken).toBe(1);
    expect(after?.waitlisted).toBe(0);
  });

  it('a hold for a household or class outside the camp is not found, and a malformed id is not found', async () => {
    const session = await makeSession(fx.repo, actor);
    const cls = await fx.repo.addClass(actor, session.id, sessionInput(9, 12, { capacity: 2 }));
    const expiresAt = holdExpiresAt(new Date());
    const otherHousehold = await addHousehold(fx, fx.orgB, 'Other camp family');
    await expect(
      holds.placeHold(actor, { sessionId: cls.id, householdId: otherHousehold, expiresAt }),
    ).rejects.toBeInstanceOf(HouseholdNotFoundError);
    await expect(
      holds.placeHold(actor, { sessionId: 'nope', householdId: otherHousehold, expiresAt }),
    ).rejects.toBeInstanceOf(ClassNotFoundError);
  });
});
