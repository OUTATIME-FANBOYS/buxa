import type { PoolClient } from 'pg';
import type { Actor, AuditAction } from '@buxa/domain';

export interface AuditEntry {
  actor: Pick<Actor, 'userId' | 'orgId'>;
  action: AuditAction;
  entity: string;
  entityId: string;
  data?: Record<string, unknown>;
}

/** The one place that writes an audit row, so every entry has the same shape and a typed action. */
export async function recordAudit(db: Pick<PoolClient, 'query'>, entry: AuditEntry): Promise<void> {
  await db.query(
    'INSERT INTO audit_log(org_id, actor_id, action, entity, entity_id, data) VALUES ($1, $2, $3, $4, $5, $6)',
    [entry.actor.orgId, entry.actor.userId, entry.action, entry.entity, entry.entityId, entry.data ?? {}],
  );
}
