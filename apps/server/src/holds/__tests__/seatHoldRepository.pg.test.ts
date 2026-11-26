import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import { holdExpiresAt, type Actor } from '@buxa/domain';
import {
  CamperNotFoundError,
  ClassNotFoundError,
  HoldExistsError,
  HoldNotFoundError,
  HouseholdNotFoundError,
  SessionFullError,
} from '../../classes/errors';
import { addSibling, householdWithChild } from './holdFixture';
import { PgSeatHoldRepository } from '../PgSeatHoldRepository';
import {
  auditActions,
  createClassFixture,
  enrolRule,
  makeSession,
  sessionInput,
  uniqueLocation,
  type ClassFixture,
} from '../../classes/__tests__/pgClassFixture';

const url = process.env.DATABASE_URL;

/** A household with one child in a camp. Holds are taken for a child of a household, so each test makes its own. */
async function addHousehold(
  fx: ClassFixture,
  orgId: string,
  name: string,
): Promise<{ householdId: string; personId: string }> {
  return withOrg(fx.pool, orgId === fx.orgB ? fx.otherActor.userId : fx.actor.userId, orgId, db =>
    householdWithChild(db, orgId, name),
  );
}

/**
 * Moves a hold's expiry into the past, as if its time had passed, without waiting for the clock. The request role cannot change an
 * expiry (migration 0055), so this runs as the test login with triggers off for the one statement.
 */
async function expireHoldNow(fx: ClassFixture, _orgId: string, holdId: string): Promise<void> {
  const client = await fx.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL session_replication_role = replica`);
    await client.query(`UPDATE seat_holds SET expires_at = now() - interval '1 minute' WHERE id = $1`, [holdId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
    const cls = await fx.repo.addClass(
      actor,
      session.id,
      sessionInput(9, 12, { location: uniqueLocation(), capacity: 1 }),
    );
    const first = await addHousehold(fx, fx.orgA, 'Hart family');
    const second = await addHousehold(fx, fx.orgA, 'Lin family');

    const hold = await holds.placeHold(actor, {
      sessionId: cls.id,
      householdId: first.householdId,
      personId: first.personId,
      expiresAt: holdExpiresAt(new Date()),
    });
    expect(hold.releasedAt).toBeNull();
    expect((await fx.repo.getClass(fx.actor.userId, fx.orgA, cls.id))?.seatsTaken).toBe(1);

    await expect(
      holds.placeHold(actor, {
        sessionId: cls.id,
        householdId: second.householdId,
        personId: second.personId,
        expiresAt: holdExpiresAt(new Date()),
      }),
    ).rejects.toBeInstanceOf(SessionFullError);
    // A full session also refuses a camper: the hold is taken from the same places.
    const camper = await fx.addPerson(fx.orgA, '2016-03-01', 'Ivy');
    await expect(fx.repo.enrol(actor, { classId: cls.id, camperId: camper }, enrolRule())).rejects.toBeInstanceOf(
      SessionFullError,
    );
  });

  it('one child holds at most one place per class, and may hold again after releasing it', async () => {
    const session = await makeSession(fx.repo, actor);
    const cls = await fx.repo.addClass(
      actor,
      session.id,
      sessionInput(9, 12, { location: uniqueLocation(), capacity: 3 }),
    );
    const household = await addHousehold(fx, fx.orgA, 'Repeat family');
    const expiresAt = holdExpiresAt(new Date());

    const hold = await holds.placeHold(actor, {
      sessionId: cls.id,
      householdId: household.householdId,
      personId: household.personId,
      expiresAt,
    });
    await expect(
      holds.placeHold(actor, {
        sessionId: cls.id,
        householdId: household.householdId,
        personId: household.personId,
        expiresAt,
      }),
    ).rejects.toBeInstanceOf(HoldExistsError);

    await holds.releaseHold(actor, hold.id);
    const again = await holds.placeHold(actor, {
      sessionId: cls.id,
      householdId: household.householdId,
      personId: household.personId,
      expiresAt,
    });
    expect(again.id).not.toBe(hold.id);
  });

  it('an expired hold stops counting at once, even before the cleanup runs', async () => {
    const session = await makeSession(fx.repo, actor);
    const cls = await fx.repo.addClass(
      actor,
      session.id,
      sessionInput(9, 12, { location: uniqueLocation(), capacity: 1 }),
    );
    const household = await addHousehold(fx, fx.orgA, 'Late family');
    const hold = await holds.placeHold(actor, {
      sessionId: cls.id,
      householdId: household.householdId,
      personId: household.personId,
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
    const cls = await fx.repo.addClass(
      actor,
      session.id,
      sessionInput(9, 12, { location: uniqueLocation(), capacity: 1 }),
    );
    const household = await addHousehold(fx, fx.orgA, 'Waiting family');
    const hold = await holds.placeHold(actor, {
      sessionId: cls.id,
      householdId: household.householdId,
      personId: household.personId,
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
    const cls = await fx.repo.addClass(
      actor,
      session.id,
      sessionInput(9, 12, { location: uniqueLocation(), capacity: 1 }),
    );
    const household = await addHousehold(fx, fx.orgA, 'Release family');
    const hold = await holds.placeHold(actor, {
      sessionId: cls.id,
      householdId: household.householdId,
      personId: household.personId,
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
    const cls = await fx.repo.addClass(
      actor,
      session.id,
      sessionInput(9, 12, { location: uniqueLocation(), capacity: 1 }),
    );
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
    const cls = await fx.repo.addClass(
      actor,
      session.id,
      sessionInput(9, 12, { location: uniqueLocation(), capacity: 1 }),
    );
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
    const cls = await fx.repo.addClass(
      actor,
      session.id,
      sessionInput(9, 12, { location: uniqueLocation(), capacity: 2 }),
    );
    const expiresAt = holdExpiresAt(new Date());
    const otherHousehold = await addHousehold(fx, fx.orgB, 'Other camp family');
    await expect(
      holds.placeHold(actor, {
        sessionId: cls.id,
        householdId: otherHousehold.householdId,
        personId: otherHousehold.personId,
        expiresAt,
      }),
    ).rejects.toBeInstanceOf(HouseholdNotFoundError);
    await expect(
      holds.placeHold(actor, {
        sessionId: 'nope',
        householdId: otherHousehold.householdId,
        personId: otherHousehold.personId,
        expiresAt,
      }),
    ).rejects.toBeInstanceOf(ClassNotFoundError);
  });
  it('siblings of one household each hold a place in the same class, and one child cannot hold it twice', async () => {
    const session = await makeSession(fx.repo, actor);
    const cls = await fx.repo.addClass(
      actor,
      session.id,
      sessionInput(9, 12, { location: uniqueLocation(), capacity: 5 }),
    );
    const first = await addHousehold(fx, fx.orgA, 'Sibling family');
    const sibling = await withOrg(pool, actor.userId, fx.orgA, db =>
      addSibling(db, fx.orgA, first.householdId, 'Second'),
    );
    const expiresAt = holdExpiresAt(new Date());

    const a = await holds.placeHold(actor, {
      sessionId: cls.id,
      householdId: first.householdId,
      personId: first.personId,
      expiresAt,
    });
    const b = await holds.placeHold(actor, {
      sessionId: cls.id,
      householdId: first.householdId,
      personId: sibling,
      expiresAt,
    });
    expect(a.personId).toBe(first.personId);
    expect(b.personId).toBe(sibling);
    expect((await fx.repo.getClass(actor.userId, fx.orgA, cls.id))?.seatsTaken).toBe(2);
    await expect(
      holds.placeHold(actor, { sessionId: cls.id, householdId: first.householdId, personId: sibling, expiresAt }),
    ).rejects.toBeInstanceOf(HoldExistsError);
  });

  it('a child who is not in the household cannot be held for it', async () => {
    const session = await makeSession(fx.repo, actor);
    const cls = await fx.repo.addClass(
      actor,
      session.id,
      sessionInput(9, 12, { location: uniqueLocation(), capacity: 2 }),
    );
    const one = await addHousehold(fx, fx.orgA, 'Own family');
    const other = await addHousehold(fx, fx.orgA, 'Stranger family');
    await expect(
      holds.placeHold(actor, {
        sessionId: cls.id,
        householdId: one.householdId,
        personId: other.personId,
        expiresAt: holdExpiresAt(new Date()),
      }),
    ).rejects.toBeInstanceOf(CamperNotFoundError);
  });

  it('a released hold cannot change, and the request role cannot update any column but the release ones', async () => {
    const session = await makeSession(fx.repo, actor);
    const cls = await fx.repo.addClass(
      actor,
      session.id,
      sessionInput(9, 12, { location: uniqueLocation(), capacity: 2 }),
    );
    const family = await addHousehold(fx, fx.orgA, 'Final family');
    const hold = await holds.placeHold(actor, {
      sessionId: cls.id,
      householdId: family.householdId,
      personId: family.personId,
      expiresAt: holdExpiresAt(new Date()),
    });
    await holds.releaseHold(actor, hold.id);

    // Even the table owner cannot un-release a hold or move it (the guard trigger).
    await expect(
      pool.query(`UPDATE seat_holds SET released_at = NULL, release_reason = NULL WHERE id = $1`, [hold.id]),
    ).rejects.toThrow(/released hold cannot be changed/);
    await expect(
      pool.query(`UPDATE seat_holds SET expires_at = now() + interval '1 day' WHERE id = $1`, [hold.id]),
    ).rejects.toThrow(/keeps its class, household, child and expiry/);
    // The request role has no UPDATE on the other columns at all.
    const live = await holds.placeHold(actor, {
      sessionId: cls.id,
      householdId: family.householdId,
      personId: family.personId,
      expiresAt: holdExpiresAt(new Date()),
    });
    await expect(
      withOrg(pool, actor.userId, fx.orgA, db =>
        db.query(`UPDATE seat_holds SET expires_at = now() + interval '1 day' WHERE id = $1`, [live.id]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      withOrg(pool, actor.userId, fx.orgA, db =>
        db.query(`UPDATE seat_holds SET session_id = $2 WHERE id = $1`, [live.id, cls.id]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
