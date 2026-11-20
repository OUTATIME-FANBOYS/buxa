import { seatsLeft } from '@buxa/domain';
import { recordAudit, type AuditActor } from '../audit/recordAudit';
import type { Db } from '../people/pgRows';
import { ClassNotFoundError } from './errors';

/*
 * Seat helpers shared by enrolments, cancellations and seat holds. They run inside the caller's transaction.
 * Lock order is fixed: a session's row is locked before any enrolment or hold row of that session is written, so no two
 * transactions can wait on each other in a cycle. The capacity triggers (migrations 0008 and 0025) take the same lock.
 */

/** Locks the session row (a class, in the app's words) and returns its capacity. Throws ClassNotFoundError when it is not in this camp. */
export async function lockSession(db: Db, sessionId: string): Promise<number> {
  const { rows } = await db.query<{ capacity: number }>(`SELECT capacity FROM sessions WHERE id = $1 FOR UPDATE`, [
    sessionId,
  ]);
  if (rows.length === 0) {
    throw new ClassNotFoundError();
  }

  return rows[0].capacity;
}

/**
 * Moves the first waitlisted enrolments (by when they joined) into the places that are free now. Free means capacity minus the
 * places taken by enrolments and unexpired holds. Call only after the session is locked. Each promotion is audited.
 * Returns how many were promoted. The capacity trigger still checks each row, so this can never overfill a session.
 */
export async function promoteWaitlist(db: Db, sessionId: string, actor: AuditActor): Promise<number> {
  const { rows: seatRows } = await db.query<{ capacity: number; taken: number }>(
    `SELECT s.capacity, session_seats_taken(s.id) AS taken FROM sessions s WHERE s.id = $1`,
    [sessionId],
  );
  const seats = seatRows[0];
  const free = seats ? seatsLeft(seats.capacity, seats.taken) : 0;
  if (free === 0) {
    return 0;
  }
  const { rows } = await db.query<{ id: string; person_id: string }>(
    `UPDATE enrolments SET status = 'enrolled'
      WHERE id IN (SELECT id FROM enrolments WHERE session_id = $1 AND status = 'waitlisted' ORDER BY created_at, id LIMIT $2)
      RETURNING id, person_id`,
    [sessionId, free],
  );
  for (const row of rows) {
    await recordAudit(db, {
      actor,
      action: 'enrolment.promote',
      entity: 'enrolment',
      entityId: row.id,
      data: { sessionId, camperId: row.person_id },
    });
  }

  return rows.length;
}
