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
  const members = await db.query<{ user_id: string; role: Role }>(
    'SELECT user_id, role FROM org_members WHERE org_id = $1',
    [event.orgId],
  );
  const teachers = rule.assignedTeachers
    ? await db.query<{ user_id: string }>('SELECT user_id FROM class_teachers WHERE org_id = $1 AND session_id = $2', [
        event.orgId,
        event.entityId,
      ])
    : null;
  const recipients = recipientsFor(
    rule,
    members.rows.map(row => ({ userId: row.user_id, role: row.role })),
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
