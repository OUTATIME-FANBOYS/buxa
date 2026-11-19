import { isUuid, MAX_AGE_LIMIT, type Actor, type EnrolmentDecision, type LocalDate } from '@buxa/domain';
import type { Enrolment } from '@buxa/contracts';
import { recordAudit } from '../audit/recordAudit';
import { toIso, type Db } from '../people/pgRows';
import type { EnrolRequest, EnrolmentRule, GatheredEnrolmentFacts } from './ClassRepository';
import { CamperNotFoundError, EnrolmentNotFoundError, refusalError, SessionNotFoundError } from './errors';
import { activeFactsFor, requireEnrolment } from './PgClassQueries';
import { translateCapacityError } from './pgClassErrors';

/*
 * The enrolment write. Runs inside the caller's transaction (withOrg). The order of locks is fixed and must stay the same
 * everywhere: the camper's row first, then the session's row. Two enrolments for one camper therefore run one after the other,
 * and the overlap check that follows sees the other one committed. The session row is locked before the facts are read, so
 * the seat count the rule sees is the one the insert is based on. The capacity trigger takes the same lock again; a lock held
 * by this transaction is not waited for, so nothing deadlocks.
 */

interface LockedSession {
  facts: GatheredEnrolmentFacts['session'];
  capacity: number;
}

/** Locks the camper's row. Row-level security makes a camper of another camp look missing. */
async function lockCamper(db: Db, camperId: string): Promise<LocalDate | null> {
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

/** Locks the session's row and reads the facts the rule needs (the session and its class). */
async function lockSession(db: Db, sessionId: string): Promise<LockedSession> {
  if (!isUuid(sessionId)) {
    throw new SessionNotFoundError();
  }
  const { rows } = await db.query<{
    id: string;
    capacity: number;
    starts_at: Date;
    ends_at: Date;
    class_name: string;
    age_min: number | null;
    age_max: number | null;
  }>(
    `SELECT s.id, s.capacity, s.starts_at, s.ends_at, c.name AS class_name, c.age_min, c.age_max
       FROM sessions s JOIN classes c ON c.id = s.class_id
      WHERE s.id = $1 FOR UPDATE OF s`,
    [sessionId],
  );
  const row = rows[0];
  if (!row) {
    throw new SessionNotFoundError();
  }

  return {
    capacity: row.capacity,
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

async function countEnrolled(db: Db, sessionId: string): Promise<number> {
  const { rows } = await db.query<{ taken: number }>(
    `SELECT count(*)::int AS taken FROM enrolments WHERE session_id = $1 AND status = 'enrolled'`,
    [sessionId],
  );

  return rows[0].taken;
}

/**
 * Enrols a camper in a session under the locks above. Throws a refusal (nothing is written) or writes the enrolment and its
 * audit entries. Returns the enrolment as read back.
 */
export async function enrolInTransaction(
  db: Db,
  actor: Actor,
  request: EnrolRequest,
  rule: EnrolmentRule,
): Promise<Enrolment> {
  const dateOfBirth = await lockCamper(db, request.camperId);
  const session = await lockSession(db, request.sessionId);
  const camperActive = await activeFactsFor(db, request.camperId);

  // A second enrolment in the same session is never allowed, even as an override: the database keeps one active row per pair.
  const already = camperActive.find(e => e.sessionId === session.facts.sessionId);
  if (already) {
    throw refusalError({ kind: 'refuse', reason: 'overlap', clash: already });
  }

  const facts: GatheredEnrolmentFacts = {
    session: session.facts,
    seatsTaken: await countEnrolled(db, session.facts.sessionId),
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

async function insertEnrolment(
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

  return requireEnrolment(db, row.id);
}
