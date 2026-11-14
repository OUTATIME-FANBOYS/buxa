import type { Actor } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import type { Db } from '../people/pgRows';
import type { CheckInRecord, NewCheckIn, NewCheckOut } from './AttendanceRepository';

/** Inserts a visit and its audit entries (one for the check-in, and one for an override). Returns the new id. */
export async function insertCheckIn(db: Db, actor: Actor, input: NewCheckIn): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO check_ins (org_id, person_id, checked_in_at, checked_in_by, method, override_reason, note)
     VALUES ($1, $2, $3::timestamptz, $4, $5, $6, $7) RETURNING id`,
    [actor.orgId, input.personId, input.at, actor.userId, input.method, input.overrideReason, input.note]);
  const id = rows[0].id;
  await recordAudit(db, { actor, action: 'attendance.check_in', entity: 'check_in', entityId: id, data: { personId: input.personId, method: input.method } });
  if (input.overrideReason !== null) {
    await recordAudit(db, { actor, action: 'attendance.override', entity: 'check_in', entityId: id, data: { personId: input.personId, phase: 'check_in', reason: input.overrideReason } });
  }
  return id;
}

/** Closes an open visit. Check-out fields are set; an override reason or note given now is added, not dropped. */
export async function closeVisit(db: Db, actor: Actor, visit: CheckInRecord, input: NewCheckOut): Promise<void> {
  await db.query(
    `UPDATE check_ins
        SET checked_out_at = $2::timestamptz, checked_out_by = $3, collected_by_person_id = $4,
            override_reason = COALESCE($5::text, override_reason), note = COALESCE($6::text, note)
      WHERE id = $1`,
    [visit.id, input.at, actor.userId, input.collectedByPersonId, input.overrideReason, input.note]);
  await recordAudit(db, {
    actor,
    action: 'attendance.check_out',
    entity: 'check_in',
    entityId: visit.id,
    data: { personId: input.personId, collectedByPersonId: input.collectedByPersonId },
  });
  if (input.overrideReason !== null) {
    await recordAudit(db, { actor, action: 'attendance.override', entity: 'check_in', entityId: visit.id, data: { personId: input.personId, phase: 'check_out', reason: input.overrideReason } });
  }
}
