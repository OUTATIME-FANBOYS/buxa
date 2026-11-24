import type { Actor, RegistrationStatus } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import type { Db } from '../people/pgRows';
import { cancelInTransaction } from '../classes/PgEnrolmentWrites';
import { releaseHoldInTransaction } from '../holds/PgSeatHoldWrites';
import { RegistrationNotFoundError, RegistrationRefusedError } from './errors';
import type { ErasureRule, WithdrawalRule } from './RegistrationRepository';

/*
 * The registration lifecycle (migration 0054): withdraw, archive and erase. Each runs inside the caller's transaction (withOrg) and
 * audits itself there. The registration row is locked first, then the places are released through the existing hold and enrolment
 * paths, which take the class's lock (the order used everywhere: registration, then class).
 */

interface LockedRegistration {
  status: RegistrationStatus;
  form_id: string;
}

/** Locks a registration of this camp. Row-level security makes another camp's registration look missing. */
async function lockRegistration(db: Db, registrationId: string): Promise<LockedRegistration> {
  const { rows } = await db.query<LockedRegistration>(
    'SELECT status, form_id FROM registrations WHERE id = $1 FOR UPDATE',
    [registrationId],
  );
  if (rows.length === 0) {
    throw new RegistrationNotFoundError();
  }

  return rows[0];
}

interface PlaceState {
  hold_id: string | null;
  hold_open: boolean;
  enrolment_id: string | null;
  enrolment_open: boolean;
}

async function placeStates(db: Db, registrationId: string): Promise<PlaceState[]> {
  const { rows } = await db.query<PlaceState>(
    `SELECT rc.hold_id, (h.id IS NOT NULL AND h.released_at IS NULL) AS hold_open,
            rc.enrolment_id, (e.id IS NOT NULL AND e.status <> 'cancelled') AS enrolment_open
       FROM registration_classes rc
       LEFT JOIN seat_holds h ON h.org_id = rc.org_id AND h.id = rc.hold_id
       LEFT JOIN enrolments e ON e.org_id = rc.org_id AND e.id = rc.enrolment_id
      WHERE rc.registration_id = $1
      ORDER BY rc.created_at, rc.id`,
    [registrationId],
  );

  return rows;
}

/**
 * Gives back every place a registration holds: its open seat holds are released and its enrolments (and waitlist entries) are
 * cancelled, through the same paths staff use, so the waitlist is promoted and each step is audited. The registration_classes rows
 * stay, so the record shows what was chosen. Returns how many holds and enrolments were given back.
 */
async function releasePlaces(
  db: Db,
  actor: Actor,
  registrationId: string,
): Promise<{ holds: number; enrolments: number }> {
  let holds = 0;
  let enrolments = 0;
  for (const place of await placeStates(db, registrationId)) {
    if (place.hold_id !== null && place.hold_open) {
      await releaseHoldInTransaction(db, actor, place.hold_id);
      holds += 1;
    }
    if (place.enrolment_id !== null && place.enrolment_open) {
      await cancelInTransaction(db, actor, place.enrolment_id, 'Registration withdrawn');
      enrolments += 1;
    }
  }

  return { holds, enrolments };
}

/**
 * Withdraws a registration: the rule is checked on its status under the lock, its holds are released and its enrolments cancelled,
 * and the registration is marked withdrawn. The record, its answers and its places stay. Audits `registration.withdraw`.
 */
export async function withdrawRegistrationInTx(
  db: Db,
  actor: Actor,
  registrationId: string,
  rule: WithdrawalRule,
): Promise<void> {
  const registration = await lockRegistration(db, registrationId);
  const decision = rule(registration.status);
  if (!decision.allow) {
    throw new RegistrationRefusedError(decision.reason);
  }
  const released = await releasePlaces(db, actor, registrationId);
  await db.query(
    `UPDATE registrations SET status = 'withdrawn', withdrawn_at = now(), withdrawn_by = $2 WHERE id = $1`,
    [registrationId, actor.userId],
  );
  await recordAudit(db, {
    actor,
    action: 'registration.withdraw',
    entity: 'registration',
    entityId: registrationId,
    data: {
      formId: registration.form_id,
      from: registration.status,
      holdsReleased: released.holds,
      enrolmentsCancelled: released.enrolments,
    },
  });
}

/** Archives a registration (hidden from lists, kept) or brings it back. Audits `registration.archive` or `registration.unarchive`. */
export async function setRegistrationArchivedInTx(
  db: Db,
  actor: Actor,
  registrationId: string,
  archived: boolean,
): Promise<void> {
  const registration = await lockRegistration(db, registrationId);
  await db.query(
    archived
      ? 'UPDATE registrations SET archived_at = COALESCE(archived_at, now()), archived_by = $2 WHERE id = $1'
      : 'UPDATE registrations SET archived_at = NULL, archived_by = NULL WHERE id = $1',
    archived ? [registrationId, actor.userId] : [registrationId],
  );
  await recordAudit(db, {
    actor,
    action: archived ? 'registration.archive' : 'registration.unarchive',
    entity: 'registration',
    entityId: registrationId,
    data: { formId: registration.form_id },
  });
}

/**
 * Erases a registration with all its answers (migration 0054, buxa_delete_registration_v1). The rule is checked first: a confirmed
 * registration that still has enrolments must be withdrawn first. A registration that was never confirmed has its holds released and
 * its waitlist entries cancelled, so no place is left behind. Audits `registration.delete` with the form and the number of places
 * only: no answer, name or contact detail goes into the audit entry.
 */
export async function eraseRegistrationInTx(
  db: Db,
  actor: Actor,
  registrationId: string,
  rule: ErasureRule,
): Promise<void> {
  const registration = await lockRegistration(db, registrationId);
  const places = await placeStates(db, registrationId);
  const decision = rule({
    status: registration.status,
    activeEnrolments: places.filter(p => p.enrolment_open).length,
  });
  if (!decision.allow) {
    throw new RegistrationRefusedError(decision.reason);
  }
  await releasePlaces(db, actor, registrationId);
  await db.query('SELECT buxa_delete_registration_v1($1, $2)', [actor.orgId, registrationId]);
  await recordAudit(db, {
    actor,
    action: 'registration.delete',
    entity: 'registration',
    entityId: registrationId,
    data: { formId: registration.form_id, status: registration.status, places: places.length },
  });
}
