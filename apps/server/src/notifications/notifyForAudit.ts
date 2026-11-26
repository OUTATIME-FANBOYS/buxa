import type { PoolClient } from 'pg';
import type { AuditAction, Role } from '@buxa/domain';
import { NOTIFY_RULES, recipientsFor } from './rules';

/** The write that happened: the camp, who did it, what it was, and the entity it touched. */
export interface NotifyEvent {
  orgId: string;
  actorUserId: string | null;
  action: AuditAction;
  entityId: string;
}

/**
 * Writes the notification rows for one audited write, in the caller's transaction: the rows commit or roll back with the event.
 * An action with no rule writes nothing and reads nothing. Called from recordAudit, so every audited write that notifies does so.
 */
export async function notifyForAudit(db: Pick<PoolClient, 'query'>, event: NotifyEvent): Promise<void> {
  const rule = NOTIFY_RULES[event.action];
  if (!rule) {
    return;
  }
  // Each member's instructor flag decides the teaching view, so a teacher gets only what the teaching view may see (docs/ROLES.md).
  const members = await db.query<{ user_id: string; role: Role; instructor: boolean }>(
    `SELECT om.user_id, om.role,
            EXISTS (
              SELECT 1 FROM people p JOIN person_roles r ON r.org_id = p.org_id AND r.person_id = p.id
               WHERE p.org_id = om.org_id AND p.user_id = om.user_id AND r.role = 'instructor'
            ) AS instructor
       FROM org_members om
      WHERE om.org_id = $1`,
    [event.orgId],
  );
  // A class's teachers are the logins linked to its instructors (people.user_id, migration 0051).
  const teachers = rule.assignedTeachers
    ? await db.query<{ user_id: string }>(
        `SELECT p.user_id FROM session_instructors si
           JOIN people p ON p.org_id = si.org_id AND p.id = si.person_id
          WHERE si.org_id = $1 AND si.session_id = $2 AND p.user_id IS NOT NULL`,
        [event.orgId, event.entityId],
      )
    : null;
  const recipients = recipientsFor(
    rule,
    members.rows.map(row => ({ userId: row.user_id, role: row.role, instructor: row.instructor })),
    event.actorUserId,
    new Set((teachers?.rows ?? []).map(row => row.user_id)),
    event.orgId,
  );
  if (recipients.length === 0) {
    return;
  }
  await db.query(
    `INSERT INTO notifications (org_id, user_id, kind, title, link)
     SELECT $1, recipient, $2, $3, $4 FROM unnest($5::uuid[]) AS recipient`,
    [event.orgId, rule.kind, rule.title, rule.link(event.entityId), recipients],
  );
}
