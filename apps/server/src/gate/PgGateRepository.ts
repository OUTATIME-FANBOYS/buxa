import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import { recordAudit } from '../audit/recordAudit';
import type { SealedToken } from '../credentials/badgeCipher';
import type {
  CodePurpose,
  ConsumeCodeOutcome,
  DeviceRow,
  GateCamp,
  GateCheckInOutcome,
  GateChild,
  GateDevice,
  GateRepository,
  GateScope,
  IssueCodeOutcome,
  SealedLink,
} from './GateRepository';

/** SQLSTATE 42501: the database refused the step (no verified code, no camp). The gate treats it as a plain refusal. */
const INSUFFICIENT_PRIVILEGE = '42501';

const isInsufficientPrivilege = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === INSUFFICIENT_PRIVILEGE;

interface ChildRow {
  person_id: string;
  given_name: string;
  family_name: string;
  session_id: string;
  session_name: string;
  on_site: boolean;
}

const toChild = (r: ChildRow): GateChild => ({
  personId: r.person_id,
  givenName: r.given_name,
  familyName: r.family_name,
  sessionId: r.session_id,
  sessionName: r.session_name,
  onSite: r.on_site,
});

/**
 * Postgres adapter for check-in with a family's email. The camp-less calls run as the request role with no user and no camp, and
 * reach the database only through the definer functions of migration 0068. The camp calls run under withOrg, so row-level security
 * (and the function's own checks) decide what the signed-in person may see.
 */
export class PgGateRepository implements GateRepository {
  constructor(private readonly pool: Pool) {}

  campForLinkHash(linkHash: Buffer): Promise<GateCamp | null> {
    return withOrg(this.pool, null, null, async db => {
      const { rows } = await db.query<{ org_id: string; camp_name: string; camp_timezone: string }>(
        'SELECT org_id, camp_name, camp_timezone FROM buxa_gate_resolve_camp_v1($1)',
        [linkHash],
      );
      const row = rows[0];

      return row ? { orgId: row.org_id, name: row.camp_name, timezone: row.camp_timezone } : null;
    });
  }

  campOf(scope: GateScope): Promise<GateCamp | null> {
    return withOrg(this.pool, scope.userId, scope.orgId, async db => {
      const { rows } = await db.query<{ id: string; name: string; timezone: string }>(
        'SELECT id, name, timezone FROM orgs WHERE id = $1',
        [scope.orgId],
      );
      const row = rows[0];

      return row ? { orgId: row.id, name: row.name, timezone: row.timezone } : null;
    });
  }

  householdForEmail(scope: GateScope, email: string): Promise<string | null> {
    return withOrg(this.pool, scope.userId, scope.orgId, async db => {
      const { rows } = await db.query<{ household: string | null }>(
        'SELECT buxa_gate_household_for_email_v1($1) AS household',
        [email],
      );

      return rows[0]?.household ?? null;
    });
  }

  issueCode(
    scope: GateScope,
    input: { householdId: string; purpose: CodePurpose; codeHash: Buffer; cooldownSeconds: number; ttlSeconds: number },
  ): Promise<IssueCodeOutcome> {
    return withOrg(this.pool, scope.userId, scope.orgId, async db => {
      const { rows } = await db.query<{ outcome: IssueCodeOutcome }>(
        'SELECT buxa_gate_issue_code_v1($1, $2, $3, $4, $5) AS outcome',
        [input.householdId, input.purpose, input.codeHash, input.cooldownSeconds, input.ttlSeconds],
      );

      return rows[0]?.outcome ?? 'refused';
    });
  }

  consumeCode(
    scope: GateScope,
    input: { householdId: string | null; purpose: CodePurpose; codeHash: Buffer; maxAttempts: number },
  ): Promise<{ outcome: ConsumeCodeOutcome; codeId: string | null }> {
    return withOrg(this.pool, scope.userId, scope.orgId, async db => {
      const { rows } = await db.query<{ outcome: ConsumeCodeOutcome; code_id: string | null }>(
        'SELECT outcome, code_id FROM buxa_gate_consume_code_v1($1, $2, $3, $4)',
        [input.householdId, input.purpose, input.codeHash, input.maxAttempts],
      );
      const row = rows[0];

      return { outcome: row?.outcome ?? 'refused', codeId: row?.code_id ?? null };
    });
  }

  async issueDevice(
    scope: GateScope,
    input: { codeId: string; householdId: string; tokenHash: Buffer },
  ): Promise<{ deviceId: string; expiresAt: Date } | null> {
    // The refusal is raised inside the transaction, so it is caught outside withOrg: the rollback then runs cleanly.
    try {
      return await withOrg(this.pool, scope.userId, scope.orgId, async db => {
        const { rows } = await db.query<{ device_id: string; expires_at: Date }>(
          'SELECT device_id, expires_at FROM buxa_gate_issue_device_v1($1, $2, $3)',
          [input.codeId, input.householdId, input.tokenHash],
        );
        const row = rows[0];

        return row ? { deviceId: row.device_id, expiresAt: row.expires_at } : null;
      });
    } catch (error) {
      if (isInsufficientPrivilege(error)) {
        return null;
      }
      throw error;
    }
  }

  deviceForTokenHash(tokenHash: Buffer): Promise<GateDevice | null> {
    return withOrg(this.pool, null, null, async db => {
      const { rows } = await db.query<{
        device_id: string;
        org_id: string;
        household_id: string;
        expires_at: Date;
        camp_name: string;
      }>('SELECT device_id, org_id, household_id, expires_at, camp_name FROM buxa_gate_device_v1($1)', [tokenHash]);
      const row = rows[0];

      return row
        ? {
            deviceId: row.device_id,
            orgId: row.org_id,
            householdId: row.household_id,
            expiresAt: row.expires_at,
            campName: row.camp_name,
          }
        : null;
    });
  }

  childrenForDevice(tokenHash: Buffer): Promise<GateChild[]> {
    return withOrg(this.pool, null, null, async db => {
      const { rows } = await db.query<ChildRow>(
        'SELECT person_id, given_name, family_name, session_id, session_name, on_site FROM buxa_gate_children_v1($1) ORDER BY given_name, session_name',
        [tokenHash],
      );

      return rows.map(toChild);
    });
  }

  childrenForDesk(scope: GateScope, householdId: string): Promise<GateChild[]> {
    return withOrg(this.pool, scope.userId, scope.orgId, async db => {
      const { rows } = await db.query<ChildRow>(
        'SELECT person_id, given_name, family_name, session_id, session_name, on_site FROM buxa_desk_children_v1($1) ORDER BY given_name, session_name',
        [householdId],
      );

      return rows.map(toChild);
    });
  }

  checkInFromDevice(
    tokenHash: Buffer,
    input: { personId: string; sessionId: string; at: Date },
  ): Promise<GateCheckInOutcome> {
    return withOrg(this.pool, null, null, async db => {
      const { rows } = await db.query<{ outcome: GateCheckInOutcome }>(
        'SELECT buxa_gate_check_in_v1($1, $2, $3, $4) AS outcome',
        [tokenHash, input.personId, input.sessionId, input.at],
      );

      return rows[0]?.outcome ?? 'refused';
    });
  }

  listDevices(scope: GateScope): Promise<DeviceRow[]> {
    return withOrg(this.pool, scope.userId, scope.orgId, async db => {
      const { rows } = await db.query<{
        id: string;
        household_id: string;
        household_name: string;
        issued_at: Date;
        expires_at: Date;
        revoked_at: Date | null;
      }>(
        `SELECT d.id, d.household_id, h.name AS household_name, d.issued_at, d.expires_at, d.revoked_at
           FROM device_tokens d JOIN households h ON h.org_id = d.org_id AND h.id = d.household_id
          ORDER BY d.issued_at DESC
          LIMIT 200`,
      );

      return rows.map(r => ({
        deviceId: r.id,
        householdId: r.household_id,
        householdName: r.household_name,
        issuedAt: r.issued_at,
        expiresAt: r.expires_at,
        revokedAt: r.revoked_at,
      }));
    });
  }

  revokeDevice(scope: GateScope, deviceId: string, at: Date): Promise<boolean> {
    return withOrg(this.pool, scope.userId, scope.orgId, async db => {
      const { rows } = await db.query<{ household_id: string }>(
        `UPDATE device_tokens SET revoked_at = $2, revoked_by = $3
          WHERE id = $1 AND revoked_at IS NULL
          RETURNING household_id`,
        [deviceId, at, scope.userId],
      );
      const row = rows[0];
      if (!row) {
        return false;
      }
      await recordAudit(db, {
        actor: { userId: scope.userId, orgId: scope.orgId },
        action: 'gate.device_revoke',
        entity: 'device',
        entityId: deviceId,
        data: { householdId: row.household_id },
      });

      return true;
    });
  }

  readLink(scope: GateScope): Promise<SealedLink | null> {
    return withOrg(this.pool, scope.userId, scope.orgId, async db => {
      const { rows } = await db.query<{ token_ciphertext: Buffer; token_iv: Buffer; token_auth_tag: Buffer }>(
        'SELECT token_ciphertext, token_iv, token_auth_tag FROM camp_gates WHERE org_id = $1',
        [scope.orgId],
      );
      const row = rows[0];
      if (!row) {
        return null;
      }
      const sealed: SealedToken = { ciphertext: row.token_ciphertext, iv: row.token_iv, authTag: row.token_auth_tag };

      return { sealed };
    });
  }

  rotateLink(scope: GateScope, input: { linkHash: Buffer; sealed: SealedToken; at: Date }): Promise<void> {
    return withOrg(this.pool, scope.userId, scope.orgId, async db => {
      await db.query(
        `INSERT INTO camp_gates (org_id, token_hash, token_ciphertext, token_iv, token_auth_tag, rotated_at, rotated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (org_id) DO UPDATE SET
           token_hash = EXCLUDED.token_hash,
           token_ciphertext = EXCLUDED.token_ciphertext,
           token_iv = EXCLUDED.token_iv,
           token_auth_tag = EXCLUDED.token_auth_tag,
           rotated_at = EXCLUDED.rotated_at,
           rotated_by = EXCLUDED.rotated_by`,
        [
          scope.orgId,
          input.linkHash,
          input.sealed.ciphertext,
          input.sealed.iv,
          input.sealed.authTag,
          input.at,
          scope.userId,
        ],
      );
      await recordAudit(db, {
        actor: { userId: scope.userId, orgId: scope.orgId },
        action: 'gate.rotate',
        entity: 'camp',
        entityId: scope.orgId,
      });
    });
  }
}
