import {
  classDatesRefusal,
  isUuid,
  MAX_AGE_LIMIT,
  type Actor,
  type EnrolmentDecision,
  type LocalDate,
} from '@buxa/domain';
import type { Enrolment } from '@buxa/contracts';
import { recordAudit } from '../audit/recordAudit';
import { toIso, type Db } from '../people/pgRows';
import type { EnrolRequest, EnrolmentRule, GatheredEnrolmentFacts } from './ClassRepository';
import {
  CamperNotFoundError,
  ClassDatesFlaggedError,
  ClassNotFoundError,
  EnrolmentNotFoundError,
  refusalError,
  SessionNotLiveError,
} from './errors';
import { activeFactsFor, requireEnrolment } from './PgClassQueries';
import { translateCapacityError } from './pgClassErrors';
import { releaseExpiredHoldsInSession } from '../holds/PgSeatHoldWrites';
import { lockSession, promoteWaitlist } from './PgSeats';

/*
 * The enrolment write. Runs inside the caller's transaction (withOrg). The order of locks is fixed and must stay the same
 * everywhere: the camper's row first, then the session's row. Two enrolments for one camper therefore run one after the other,
 * and the overlap check that follows sees the other one committed. The session row is locked before the facts are read, so
 * the seat count the rule sees is the one the insert is based on. The capacity trigger takes the same lock again; a lock held
 * by this transaction is not waited for, so nothing deadlocks.
 */

export interface LockedSession {
  facts: GatheredEnrolmentFacts['session'];
  capacity: number;
  /** The class is flagged: its dates are outside its session's dates (migration 0059). Callers refuse it with classDatesRefusal. */
  datesOutsideSession: boolean;
}

/** Locks the camper's row. Row-level security makes a camper of another camp look missing. */
export async function lockCamper(db: Db, camperId: string): Promise<LocalDate | null> {
  if (!isUuid(camperId)) {
    throw new CamperNotFoundError();
  }
  const { rows } = await db.query<{ date_of_birth: string | null }>(
    `SELECT to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth FROM people WHERE id = $1 FOR UPDATE`,
    [camperId],
  );
  if (rows.length === 0) {
    throw new CamperNotFoundError();
  }

  return rows[0].date_of_birth;
}

/**
 * Locks the class's row and reads the facts the rule needs. The class's own name and ages are what the rule uses. Throws
 * SessionNotLiveError when its session is a draft or archived.
 */
export async function lockClass(db: Db, classId: string): Promise<LockedSession> {
  if (!isUuid(classId)) {
    throw new ClassNotFoundError();
  }
  const { rows } = await db.query<{
    id: string;
    capacity: number;
    starts_at: Date;
    ends_at: Date;
    class_name: string;
    age_min: number | null;
    age_max: number | null;
    session_status: 'draft' | 'live' | 'archived';
    dates_outside_session: boolean;
  }>(
    `SELECT s.id, s.capacity, s.starts_at, s.ends_at, s.name AS class_name, s.age_min, s.age_max, s.dates_outside_session, p.status AS session_status
       FROM sessions s
       JOIN classes p ON p.id = s.class_id AND p.org_id = s.org_id
      WHERE s.id = $1 FOR UPDATE OF s`,
    [classId],
  );
  const row = rows[0];
  if (!row) {
    throw new ClassNotFoundError();
  }
  // Registration and enrolment are accepted only while the session is live (a draft is not open yet, an archived one is closed).
  if (row.session_status !== 'live') {
    throw new SessionNotLiveError(row.session_status);
  }

  return {
    capacity: row.capacity,
    datesOutsideSession: row.dates_outside_session,
    facts: {
      sessionId: row.id,
      className: row.class_name,
      startsAt: toIso(row.starts_at),
      endsAt: toIso(row.ends_at),
      capacity: row.capacity,
      ageRange: { minAge: row.age_min ?? 0, maxAge: row.age_max ?? MAX_AGE_LIMIT },
    },
  };
}

/** Places taken: enrolled campers plus unexpired holds (migration 0025). The rule must see the holds, or it would promise a seat the trigger refuses. */
export async function countTaken(db: Db, sessionId: string): Promise<number> {
  const { rows } = await db.query<{ taken: number }>(`SELECT session_seats_taken($1)::int AS taken`, [sessionId]);

  return rows[0].taken;
}

/**
 * Enrols a camper in a class under the locks above. Throws a refusal (nothing is written) or writes the enrolment and its
 * audit entries. Returns the enrolment as read back.
 */
export async function enrolInTransaction(
  db: Db,
  actor: Actor,
  request: EnrolRequest,
  rule: EnrolmentRule,
): Promise<Enrolment> {
  const dateOfBirth = await lockCamper(db, request.camperId);
  const session = await lockClass(db, request.classId);
  if (classDatesRefusal(session.datesOutsideSession) !== null) {
    throw new ClassDatesFlaggedError();
  }
  // Expired holds give their places back first, and the waitlist takes them, so the seat count below is current.
  await releaseExpiredHoldsInSession(db, session.facts.sessionId, actor);
  const camperActive = await activeFactsFor(db, request.camperId);

  // A second enrolment in the same session is never allowed, even as an override: the database keeps one active row per pair.
  const already = camperActive.find(e => e.sessionId === session.facts.sessionId);
  if (already) {
    throw refusalError({ kind: 'refuse', reason: 'overlap', clash: already });
  }

  const facts: GatheredEnrolmentFacts = {
    session: session.facts,
    seatsTaken: await countTaken(db, session.facts.sessionId),
    camperDateOfBirth: dateOfBirth,
    camperActive,
  };
  const decision = rule(facts);
  if (decision.kind === 'refuse') {
    throw refusalError(decision);
  }

  const id = await insertEnrolment(db, actor, request, session, decision);

  return requireEnrolment(db, id);
}

export async function insertEnrolment(
  db: Db,
  actor: Actor,
  request: EnrolRequest,
  session: LockedSession,
  decision: Extract<EnrolmentDecision, { kind: 'allow' }>,
): Promise<string> {
  let id: string;
  try {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO enrolments (org_id, session_id, person_id, status, overridden, override_reason)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        actor.orgId,
        session.facts.sessionId,
        request.camperId,
        decision.status,
        decision.overrode !== null,
        decision.overrode?.reason ?? null,
      ],
    );
    id = rows[0].id;
  } catch (error) {
    throw translateCapacityError(error, session.capacity);
  }
  await recordAudit(db, {
    actor,
    action: 'enrolment.create',
    entity: 'enrolment',
    entityId: id,
    data: { sessionId: session.facts.sessionId, camperId: request.camperId, status: decision.status },
  });
  if (decision.overrode) {
    await recordAudit(db, {
      actor,
      action: 'enrolment.override',
      entity: 'enrolment',
      entityId: id,
      data: {
        sessionId: session.facts.sessionId,
        camperId: request.camperId,
        reason: decision.overrode.reason,
        clashSessionId: decision.overrode.clash.sessionId,
      },
    });
  }

  return id;
}

/**
 * Cancels an enrolment: the seat and the time are freed, and the row stays for the record. A row already cancelled (or another
 * camp's, or a malformed id) is not found.
 */
export async function cancelInTransaction(
  db: Db,
  actor: Actor,
  enrolmentId: string,
  note: string | null,
): Promise<Enrolment> {
  if (!isUuid(enrolmentId)) {
    throw new EnrolmentNotFoundError();
  }
  const { rows: live } = await db.query<{ session_id: string }>(
    `SELECT session_id FROM enrolments WHERE id = $1 AND status <> 'cancelled'`,
    [enrolmentId],
  );
  if (live.length === 0) {
    throw new EnrolmentNotFoundError();
  }
  // The session lock comes before the enrolment row (see PgSeats): the status is read again under it, because a waitlisted
  // row can be promoted by another transaction between the two statements.
  await lockSession(db, live[0].session_id);
  const { rows: current } = await db.query<{ status: string }>(
    `SELECT status FROM enrolments WHERE id = $1 AND status <> 'cancelled' FOR UPDATE`,
    [enrolmentId],
  );
  if (current.length === 0) {
    throw new EnrolmentNotFoundError();
  }
  const { rows } = await db.query<{ id: string; session_id: string; person_id: string }>(
    `UPDATE enrolments SET status = 'cancelled', cancelled_at = now()
      WHERE id = $1 AND status <> 'cancelled' RETURNING id, session_id, person_id`,
    [enrolmentId],
  );
  const row = rows[0];
  if (!row) {
    throw new EnrolmentNotFoundError();
  }
  await recordAudit(db, {
    actor,
    action: 'enrolment.cancel',
    entity: 'enrolment',
    entityId: row.id,
    data: { sessionId: row.session_id, camperId: row.person_id, note },
  });
  // Only a place that was really taken goes to the waitlist; a cancelled waitlist entry frees nothing.
  if (current[0].status === 'enrolled') {
    await promoteWaitlist(db, row.session_id, actor);
  }

  return requireEnrolment(db, row.id);
}
