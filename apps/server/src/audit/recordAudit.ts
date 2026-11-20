import type { PoolClient } from 'pg';
import type { AuditAction } from '@buxa/domain';
import type { AuditData } from './types';
import { notifyForAudit } from '../notifications/notifyForAudit';

/** The actor of an entry. `userId` is null for the system's own work (the expiry cleanup), which has no user. */
export interface AuditActor {
  userId: string | null;
  orgId: string;
}

export interface AuditEntry {
  actor: AuditActor;
  action: AuditAction;
  entity: string;
  entityId: string;
  data?: AuditData;
}

/**
 * The one place that writes an audit row, so every entry has the same shape and a typed action. The same transaction also writes
 * the notifications the write causes (apps/server/src/notifications), so a notification never outlives a rolled-back event.
 */
export async function recordAudit(db: Pick<PoolClient, 'query'>, entry: AuditEntry): Promise<void> {
  await db.query(
    'INSERT INTO audit_log(org_id, actor_id, action, entity, entity_id, data) VALUES ($1, $2, $3, $4, $5, $6)',
    [entry.actor.orgId, entry.actor.userId, entry.action, entry.entity, entry.entityId, entry.data ?? {}],
  );
  await notifyForAudit(db, {
    orgId: entry.actor.orgId,
    actorUserId: entry.actor.userId,
    action: entry.action,
    entityId: entry.entityId,
  });
}
