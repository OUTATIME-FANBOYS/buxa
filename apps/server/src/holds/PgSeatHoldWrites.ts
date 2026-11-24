import { isUuid, type Actor } from '@buxa/domain';
import { recordAudit, type AuditActor } from '../audit/recordAudit';
import { toIso, type Db } from '../people/pgRows';
import { lockSession, promoteWaitlist } from '../classes/PgSeats';
import { sessionStatusOfClass } from '../classes/PgClassQueries';
import {
  CamperNotFoundError,
  ClassNotFoundError,
  HoldExistsError,
  SessionNotLiveError,
  HoldNotFoundError,
  HouseholdNotFoundError,
  SessionFullError,
} from '../classes/errors';
import type { ActiveHold, PlaceHoldRequest, SeatHold } from './SeatHoldRepository';

/*
 * Seat holds, written inside the caller's transaction (withOrg). Capacity itself is enforced by the trigger in migration 0025,
 * under the session lock; this file takes the same lock first, frees expired holds, and then writes.
 */

const HOLD_COLUMNS = `id, session_id, household_id, person_id, created_at, expires_at, released_at, release_reason`;

interface HoldRow {
  id: string;
  session_id: string;
  household_id: string;
  person_id: string | null;
  created_at: Date;
  expires_at: Date;
  released_at: Date | null;
  release_reason: 'cancelled' | 'expired' | 'completed' | null;
}

async function readHold(db: Db, holdId: string): Promise<SeatHold> {
  const { rows } = await db.query<HoldRow>(`SELECT ${HOLD_COLUMNS} FROM seat_holds WHERE id = $1`, [holdId]);
  if (rows.length === 0) {
    throw new HoldNotFoundError();
  }
  const row = rows[0];

  return {
    id: row.id,
    sessionId: row.session_id,
    householdId: row.household_id,
    personId: row.person_id,
    createdAt: toIso(row.created_at),
    expiresAt: toIso(row.expires_at),
    releasedAt: row.released_at === null ? null : toIso(row.released_at),
    releaseReason: row.release_reason,
  };
}

/**
 * Releases the expired holds of one session and promotes the waitlist into the places they return. Locks the session first.
 * Safe to run any number of times: a released hold is no longer selected, so a second run finds nothing to do.
 * Returns how many holds were released.
 */
export async function releaseExpiredHoldsInSession(db: Db, sessionId: string, actor: AuditActor): Promise<number> {
  await lockSession(db, sessionId);
  const { rows } = await db.query<{ id: string; household_id: string }>(
    `UPDATE seat_holds SET released_at = now(), release_reason = 'expired'
      WHERE session_id = $1 AND released_at IS NULL AND expires_at <= now()
      RETURNING id, household_id`,
    [sessionId],
  );
  for (const row of rows) {
    await recordAudit(db, {
      actor,
      action: 'hold.expire',
      entity: 'seat_hold',
      entityId: row.id,
      data: { sessionId, householdId: row.household_id },
    });
  }
  await promoteWaitlist(db, sessionId, actor);

  return rows.length;
}

/** The cleanup for a camp: releases every expired hold, session by session. Used by a job, with no user behind it. */
export async function releaseExpiredHolds(db: Db, actor: AuditActor): Promise<number> {
  const { rows } = await db.query<{ session_id: string }>(
    `SELECT DISTINCT session_id FROM seat_holds WHERE released_at IS NULL AND expires_at <= now() ORDER BY session_id`,
  );
  let released = 0;
  for (const row of rows) {
    released += await releaseExpiredHoldsInSession(db, row.session_id, actor);
  }

  return released;
}

/**
 * Takes one place for a child of a household. Frees the session's expired holds first (so the place they hold is free and the
 * child's own expired hold does not block it), then writes the hold. A full session refuses with SessionFullError from the
 * trigger; a second active hold for the same child and class refuses with HoldExistsError. Siblings each hold their own place.
 */
export async function placeHoldInTransaction(db: Db, actor: Actor, request: PlaceHoldRequest): Promise<SeatHold> {
  if (!isUuid(request.sessionId)) {
    throw new ClassNotFoundError();
  }
  if (!isUuid(request.householdId)) {
    throw new HouseholdNotFoundError();
  }
  if (!isUuid(request.personId)) {
    throw new CamperNotFoundError();
  }
  const capacity = await lockSession(db, request.sessionId);
  const status = await sessionStatusOfClass(db, request.sessionId);
  if (status !== null && status !== 'live') {
    throw new SessionNotLiveError(status);
  }
  await releaseExpiredHoldsInSession(db, request.sessionId, actor);

  const household = await db.query(`SELECT 1 FROM households WHERE id = $1`, [request.householdId]);
  if (household.rows.length === 0) {
    throw new HouseholdNotFoundError();
  }

  const member = await db.query(`SELECT 1 FROM household_members WHERE household_id = $1 AND person_id = $2`, [
    request.householdId,
    request.personId,
  ]);
  if (member.rows.length === 0) {
    throw new CamperNotFoundError();
  }

  let id: string;
  try {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO seat_holds (org_id, session_id, household_id, person_id, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [actor.orgId, request.sessionId, request.householdId, request.personId, request.expiresAt],
    );
    id = rows[0].id;
  } catch (error) {
    throw translateHoldError(error, capacity);
  }
  await recordAudit(db, {
    actor,
    action: 'hold.create',
    entity: 'seat_hold',
    entityId: id,
    data: {
      sessionId: request.sessionId,
      householdId: request.householdId,
      personId: request.personId,
      expiresAt: request.expiresAt.toISOString(),
    },
  });

  return readHold(db, id);
}

/**
 * Releases a hold before it expires (reason `cancelled`), or after it has expired but before the cleanup ran (reason `expired`).
 * The freed place goes to the first waitlisted enrolment. A hold that is already released is not found.
 */
export async function releaseHoldInTransaction(db: Db, actor: Actor, holdId: string): Promise<SeatHold> {
  if (!isUuid(holdId)) {
    throw new HoldNotFoundError();
  }
  const { rows: found } = await db.query<{ session_id: string }>(
    `SELECT session_id FROM seat_holds WHERE id = $1 AND released_at IS NULL`,
    [holdId],
  );
  if (found.length === 0) {
    throw new HoldNotFoundError();
  }
  const sessionId = found[0].session_id;
  await lockSession(db, sessionId);

  const { rows } = await db.query<{ household_id: string; reason: string }>(
    `UPDATE seat_holds
        SET released_at = now(),
            release_reason = CASE WHEN expires_at > now() THEN 'cancelled' ELSE 'expired' END
      WHERE id = $1 AND released_at IS NULL
      RETURNING household_id, release_reason AS reason`,
    [holdId],
  );
  if (rows.length === 0) {
    throw new HoldNotFoundError();
  }
  await recordAudit(db, {
    actor,
    action: 'hold.release',
    entity: 'seat_hold',
    entityId: holdId,
    data: { sessionId, householdId: rows[0].household_id, reason: rows[0].reason },
  });
  await promoteWaitlist(db, sessionId, actor);

  return readHold(db, holdId);
}

/** Turns the hold trigger's error into SessionFullError, and a second active hold for the same child into HoldExistsError. Other errors pass through. */
function translateHoldError(error: unknown, capacity: number): unknown {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return error;
  }
  if (error.code === '23514' && 'constraint' in error && error.constraint === 'seat_holds_capacity') {
    return new SessionFullError({ kind: 'refuse', reason: 'session_full', capacity });
  }
  if (error.code === '23505' && 'constraint' in error && error.constraint === 'seat_holds_one_active_person_idx') {
    return new HoldExistsError();
  }

  return error;
}

/** The holds that hold a place in a class now, for the class page. Locks nothing: a read. Throws ClassNotFoundError for an unknown class. */
export async function listActiveHoldRows(db: Db, sessionId: string): Promise<ActiveHold[]> {
  if (!isUuid(sessionId)) {
    throw new ClassNotFoundError();
  }
  const { rows: exists } = await db.query(`SELECT 1 FROM sessions WHERE id = $1`, [sessionId]);
  if (exists.length === 0) {
    throw new ClassNotFoundError();
  }
  const { rows } = await db.query<{
    id: string;
    household_id: string;
    household_name: string;
    created_at: Date;
    expires_at: Date;
  }>(
    `SELECT h.id, h.household_id, hh.name AS household_name, h.created_at, h.expires_at
       FROM seat_holds h
       JOIN households hh ON hh.id = h.household_id AND hh.org_id = h.org_id
      WHERE h.session_id = $1 AND h.released_at IS NULL AND h.expires_at > now()
      ORDER BY h.created_at, h.id`,
    [sessionId],
  );

  return rows.map(r => ({
    id: r.id,
    householdId: r.household_id,
    householdName: r.household_name,
    createdAt: toIso(r.created_at),
    expiresAt: toIso(r.expires_at),
  }));
}

/**
 * Promotes waitlisted enrolments into the free places of a class, under the class lock. Returns how many moved. Each promotion is
 * audited by promoteWaitlist as `enrolment.promote`. Nothing moves when no place is free.
 */
export async function promoteWaitlistInTransaction(db: Db, actor: Actor, sessionId: string): Promise<number> {
  if (!isUuid(sessionId)) {
    throw new ClassNotFoundError();
  }
  await lockSession(db, sessionId);
  await releaseExpiredHoldsInSession(db, sessionId, actor);

  return promoteWaitlist(db, sessionId, actor);
}
