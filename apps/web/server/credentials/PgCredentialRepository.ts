import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import { isUuid, type Actor } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import { PersonNotFoundError } from '../people/PeopleRepository';
import { personExists } from '../people/PgPersonQueries';
import { nullableIso, toIso, type Db } from '../people/pgRows';
import type { CredentialRecord, CredentialRepository } from './CredentialRepository';

interface CredentialRow {
  id: string;
  person_id: string;
  issued_at: Date;
  issued_by: string | null;
  revoked_at: Date | null;
}

const COLUMNS = 'id, person_id, issued_at, issued_by, revoked_at';

const toRecord = (row: CredentialRow): CredentialRecord => ({
  id: row.id,
  personId: row.person_id,
  issuedAt: toIso(row.issued_at),
  issuedBy: row.issued_by,
  revokedAt: nullableIso(row.revoked_at),
});

async function activeOf(db: Db, personId: string): Promise<CredentialRecord | null> {
  if (!isUuid(personId)) return null;
  const { rows } = await db.query<CredentialRow>(`SELECT ${COLUMNS} FROM credentials WHERE person_id = $1 AND revoked_at IS NULL`, [personId]);
  return rows[0] ? toRecord(rows[0]) : null;
}

/** Postgres adapter for badges. Only the token hash is passed in and stored; the token never reaches this file. */
export class PgCredentialRepository implements CredentialRepository {
  constructor(private readonly pool: Pool) {}

  issue(actor: Actor, personId: string, tokenHash: Buffer, at: string): Promise<CredentialRecord> {
    return withOrg(this.pool, actor.orgId, async db => {
      if (!(await personExists(db, personId))) throw new PersonNotFoundError();
      const revoked = await db.query<{ id: string }>(
        'UPDATE credentials SET revoked_at = $2::timestamptz WHERE person_id = $1 AND revoked_at IS NULL RETURNING id',
        [personId, at]);
      const { rows } = await db.query<CredentialRow>(
        `INSERT INTO credentials (org_id, person_id, token_hash, issued_at, issued_by)
         VALUES ($1, $2, $3, $4::timestamptz, $5) RETURNING ${COLUMNS}`,
        [actor.orgId, personId, tokenHash, at, actor.userId]);
      const credential = toRecord(rows[0]);
      await recordAudit(db, {
        actor,
        action: 'credential.issue',
        entity: 'credential',
        entityId: credential.id,
        data: { personId, replaces: revoked.rows[0]?.id ?? null },
      });
      return credential;
    });
  }

  revoke(actor: Actor, personId: string, at: string): Promise<CredentialRecord | null> {
    if (!isUuid(personId)) return Promise.resolve(null);
    return withOrg(this.pool, actor.orgId, async db => {
      const { rows } = await db.query<CredentialRow>(
        `UPDATE credentials SET revoked_at = $2::timestamptz WHERE person_id = $1 AND revoked_at IS NULL RETURNING ${COLUMNS}`,
        [personId, at]);
      const row = rows[0];
      if (!row) return null;
      await recordAudit(db, { actor, action: 'credential.revoke', entity: 'credential', entityId: row.id, data: { personId } });
      return toRecord(row);
    });
  }

  activeFor(orgId: string, personId: string): Promise<CredentialRecord | null> {
    return withOrg(this.pool, orgId, db => activeOf(db, personId));
  }

  resolve(orgId: string, tokenHash: Buffer): Promise<string | null> {
    return withOrg(this.pool, orgId, async db => {
      const { rows } = await db.query<{ person_id: string }>(
        'SELECT person_id FROM credentials WHERE token_hash = $1 AND revoked_at IS NULL', [tokenHash]);
      return rows[0]?.person_id ?? null;
    });
  }

  withActive(orgId: string, personIds: readonly string[]): Promise<Set<string>> {
    const valid = personIds.filter(isUuid);
    if (valid.length === 0) return Promise.resolve(new Set());
    return withOrg(this.pool, orgId, async db => {
      const { rows } = await db.query<{ person_id: string }>(
        'SELECT DISTINCT person_id FROM credentials WHERE person_id = ANY($1::uuid[]) AND revoked_at IS NULL', [valid]);
      return new Set(rows.map(r => r.person_id));
    });
  }
}
