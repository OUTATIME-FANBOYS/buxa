import type { Pool } from 'pg';
import { isUniqueViolation, withOrg } from '@buxa/db';
import { isUuid, type Actor } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import { PersonNotFoundError } from '../people/PeopleRepository';
import { personExists } from '../people/PgPersonQueries';
import { nullableIso, toIso, type Db } from '../people/pgRows';
import { type SealedToken } from './badgeCipher';
import {
  BadgeConflictError,
  type CredentialRecord,
  type CredentialRepository,
  type RevealedBadge,
} from './CredentialRepository';

interface CredentialRow {
  id: string;
  person_id: string;
  issued_at: Date;
  issued_by: string | null;
  revoked_at: Date | null;
}

const COLUMNS = 'id, person_id, issued_at, issued_by, revoked_at';
/** A revoked badge keeps no sealed copy: only the active badge of a person can be shown. */
const WIPE_SEALED = 'token_ciphertext = NULL, token_iv = NULL, token_auth_tag = NULL';

/** A row of buxa_reveal_badge(): the request role cannot SELECT the sealed columns of credentials (migration 0057). */
interface SealedRow {
  credential_id: string;
  sealed_ciphertext: Buffer | null;
  sealed_iv: Buffer | null;
  sealed_auth_tag: Buffer | null;
}

/** The sealed copy in its row, or null for a badge issued before encrypted copies existed. */
const sealedOf = (row: SealedRow): SealedToken | null =>
  row.sealed_ciphertext && row.sealed_iv && row.sealed_auth_tag
    ? { ciphertext: row.sealed_ciphertext, iv: row.sealed_iv, authTag: row.sealed_auth_tag }
    : null;

const toRecord = (row: CredentialRow): CredentialRecord => ({
  id: row.id,
  personId: row.person_id,
  issuedAt: toIso(row.issued_at),
  issuedBy: row.issued_by,
  revokedAt: nullableIso(row.revoked_at),
});

async function activeOf(db: Db, personId: string): Promise<CredentialRecord | null> {
  if (!isUuid(personId)) {
    return null;
  }
  const { rows } = await db.query<CredentialRow>(
    `SELECT ${COLUMNS} FROM credentials WHERE person_id = $1 AND revoked_at IS NULL`,
    [personId],
  );

  return rows[0] ? toRecord(rows[0]) : null;
}

/**
 * Runs a badge query in its own tenant transaction (the pool), or inside an open one (a confirmation writes its badges in its own
 * transaction, so both commit together).
 */
export type CredentialScope = <T>(userId: string, orgId: string, work: (db: Db) => Promise<T>) => Promise<T>;

export const poolScope =
  (pool: Pool): CredentialScope =>
  (userId, orgId, work) =>
    withOrg(pool, userId, orgId, work);

/** A scope that reuses an open transaction. The caller has already set the tenant on it. */
export const transactionScope =
  (db: Db): CredentialScope =>
  (_userId, _orgId, work) =>
    work(db);

/** Postgres adapter for badges. Only the token hash is passed in and stored; the token never reaches this file. */
export class PgCredentialRepository implements CredentialRepository {
  constructor(private readonly scope: CredentialScope) {}

  /**
   * A concurrent issue that loses the race on the active-badge unique index is reported as BadgeConflictError, not a 500. A reissue
   * (one that replaces an active badge) audits `badge.reissue`; a first badge audits `credential.issue`.
   */
  async issue(
    actor: Actor,
    personId: string,
    tokenHash: Buffer,
    at: string,
    sealed: SealedToken | null = null,
  ): Promise<CredentialRecord> {
    try {
      return await this.issueOnce(actor, personId, tokenHash, at, sealed);
    } catch (error) {
      throw isUniqueViolation(error) ? new BadgeConflictError() : error;
    }
  }

  private issueOnce(
    actor: Actor,
    personId: string,
    tokenHash: Buffer,
    at: string,
    sealed: SealedToken | null,
  ): Promise<CredentialRecord> {
    return this.scope(actor.userId, actor.orgId, async db => {
      if (!(await personExists(db, personId))) {
        throw new PersonNotFoundError();
      }
      const revoked = await db.query<{ id: string }>(
        `UPDATE credentials SET revoked_at = $2::timestamptz, ${WIPE_SEALED} WHERE person_id = $1 AND revoked_at IS NULL RETURNING id`,
        [personId, at],
      );
      const { rows } = await db.query<CredentialRow>(
        `INSERT INTO credentials (org_id, person_id, token_hash, issued_at, issued_by, token_ciphertext, token_iv, token_auth_tag)
         VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7, $8) RETURNING ${COLUMNS}`,
        [
          actor.orgId,
          personId,
          tokenHash,
          at,
          actor.userId,
          sealed?.ciphertext ?? null,
          sealed?.iv ?? null,
          sealed?.authTag ?? null,
        ],
      );
      const credential = toRecord(rows[0]);
      const replaces = revoked.rows[0]?.id ?? null;
      await recordAudit(db, {
        actor,
        action: replaces ? 'badge.reissue' : 'credential.issue',
        entity: 'credential',
        entityId: credential.id,
        data: { personId, replaces },
      });

      return credential;
    });
  }

  revoke(actor: Actor, personId: string, at: string): Promise<CredentialRecord | null> {
    if (!isUuid(personId)) {
      return Promise.resolve(null);
    }

    return this.scope(actor.userId, actor.orgId, async db => {
      const { rows } = await db.query<CredentialRow>(
        `UPDATE credentials SET revoked_at = $2::timestamptz, ${WIPE_SEALED} WHERE person_id = $1 AND revoked_at IS NULL RETURNING ${COLUMNS}`,
        [personId, at],
      );
      const row = rows[0];
      if (!row) {
        return null;
      }
      await recordAudit(db, {
        actor,
        action: 'credential.revoke',
        entity: 'credential',
        entityId: row.id,
        data: { personId },
      });

      return toRecord(row);
    });
  }

  reveal(actor: Actor, personId: string, action: 'badge.view' | 'badge.reprint'): Promise<RevealedBadge | null> {
    if (!isUuid(personId)) {
      return Promise.resolve(null);
    }

    return this.scope(actor.userId, actor.orgId, async db => {
      const { rows } = await db.query<SealedRow>(
        'SELECT credential_id, sealed_ciphertext, sealed_iv, sealed_auth_tag FROM buxa_reveal_badge($1, $2)',
        [actor.orgId, personId],
      );
      const row = rows[0];
      if (!row) {
        return null;
      }
      await recordAudit(db, { actor, action, entity: 'credential', entityId: row.credential_id, data: { personId } });

      return { credentialId: row.credential_id, sealed: sealedOf(row) };
    });
  }

  activeFor(userId: string, orgId: string, personId: string): Promise<CredentialRecord | null> {
    return this.scope(userId, orgId, db => activeOf(db, personId));
  }

  resolve(userId: string, orgId: string, tokenHash: Buffer): Promise<string | null> {
    return this.scope(userId, orgId, async db => {
      const { rows } = await db.query<{ person_id: string }>(
        'SELECT person_id FROM credentials WHERE token_hash = $1 AND revoked_at IS NULL',
        [tokenHash],
      );

      return rows[0]?.person_id ?? null;
    });
  }

  withActive(userId: string, orgId: string, personIds: readonly string[]): Promise<Set<string>> {
    const valid = personIds.filter(isUuid);
    if (valid.length === 0) {
      return Promise.resolve(new Set());
    }

    return this.scope(userId, orgId, async db => {
      const { rows } = await db.query<{ person_id: string }>(
        'SELECT DISTINCT person_id FROM credentials WHERE person_id = ANY($1::uuid[]) AND revoked_at IS NULL',
        [valid],
      );

      return new Set(rows.map(r => r.person_id));
    });
  }
}
