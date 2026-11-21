import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import { isUuid, type Actor } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import { toIso } from '../people/pgRows';
import {
  InviteRefusedError,
  type InviteLookup,
  type InviteRecord,
  type InviteRefusal,
  type JoinProfile,
  type MemberInviteRepository,
  type NewInvite,
  type SignedInPerson,
} from './MemberInviteRepository';

interface InviteRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  created_at: Date;
  expires_at: Date;
}

const COLUMNS = 'id, email, name, phone, created_at, expires_at';

const toRecord = (row: InviteRow): InviteRecord => ({
  id: row.id,
  email: row.email,
  name: row.name,
  phone: row.phone,
  createdAt: toIso(row.created_at),
  expiresAt: toIso(row.expires_at),
});

/** The constraint tag the accept function raises with (migration 0038) mapped to the refusal it means. */
const REFUSALS = new Map<string, InviteRefusal>([
  ['invite_unusable', 'unusable'],
  ['invite_wrong_email', 'wrong-email'],
  ['invite_already_member', 'already-member'],
]);

function refusalOf(error: unknown): InviteRefusal | null {
  if (typeof error === 'object' && error !== null && 'constraint' in error && typeof error.constraint === 'string') {
    return REFUSALS.get(error.constraint) ?? null;
  }

  return null;
}

/**
 * Postgres adapter for teacher invites. Only the token hash is passed in and stored; the raw token never reaches this file.
 * Accepting runs the profile write and the join in one transaction, so a refused join leaves the profile unchanged.
 */
export class PgMemberInviteRepository implements MemberInviteRepository {
  constructor(private readonly pool: Pool) {}

  create(actor: Actor, invite: NewInvite, tokenHash: Buffer): Promise<InviteRecord> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      const { rows } = await db.query<InviteRow>(
        `INSERT INTO member_invites (org_id, email, name, phone, role, token_hash, created_by)
         VALUES ($1, $2, $3, $4, 'teacher', $5, $6) RETURNING ${COLUMNS}`,
        [actor.orgId, invite.email, invite.name, invite.phone, tokenHash, actor.userId],
      );
      const record = toRecord(rows[0]);
      await recordAudit(db, {
        actor,
        action: 'member.invite',
        entity: 'member_invite',
        entityId: record.id,
        data: { role: 'teacher' },
      });

      return record;
    });
  }

  resend(actor: Actor, inviteId: string, tokenHash: Buffer): Promise<InviteRecord | null> {
    if (!isUuid(inviteId)) {
      return Promise.resolve(null);
    }

    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      // Only a pending invite can be sent again. The row policy limits the update to this camp and to staff and above.
      const { rows } = await db.query<InviteRow>(
        `UPDATE member_invites SET token_hash = $2, expires_at = now() + interval '7 days'
          WHERE id = $1 AND accepted_at IS NULL RETURNING ${COLUMNS}`,
        [inviteId, tokenHash],
      );
      const row = rows[0];
      if (!row) {
        return null;
      }
      await recordAudit(db, {
        actor,
        action: 'member.invite_resend',
        entity: 'member_invite',
        entityId: row.id,
        data: { role: 'teacher' },
      });

      return toRecord(row);
    });
  }

  listPending(actor: Actor): Promise<InviteRecord[]> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      const { rows } = await db.query<InviteRow>(
        `SELECT ${COLUMNS} FROM member_invites WHERE org_id = $1 AND accepted_at IS NULL ORDER BY created_at DESC, id`,
        [actor.orgId],
      );

      return rows.map(toRecord);
    });
  }

  lookup(person: SignedInPerson, tokenHash: Buffer): Promise<InviteLookup | null> {
    return withOrg(this.pool, person.userId, null, async db => {
      // buxa_invite_for_accept (migration 0038) returns no row for an unknown, expired or used token.
      const { rows } = await db.query<{
        org_id: string;
        org_name: string;
        invite_name: string;
        invite_phone: string | null;
        email_matches: boolean | null;
        already_member: boolean;
      }>('SELECT * FROM buxa_invite_for_accept($1)', [tokenHash]);
      const row = rows[0];
      if (!row) {
        return null;
      }

      return {
        orgId: row.org_id,
        orgName: row.org_name,
        name: row.invite_name,
        phone: row.invite_phone,
        emailMatches: row.email_matches === true,
        alreadyMember: row.already_member,
      };
    });
  }

  async accept(
    person: SignedInPerson,
    tokenHash: Buffer,
    profile: JoinProfile,
  ): Promise<{ orgId: string; orgName: string }> {
    try {
      return await withOrg(this.pool, person.userId, null, async db => {
        // The profile is written first; if the join is refused the transaction rolls back and the profile is unchanged.
        await db.query('SELECT buxa_set_user_profile($1, $2, $3)', [
          profile.firstName,
          profile.lastName,
          profile.phone,
        ]);
        const { rows } = await db.query<{ org_id: string; org_name: string }>(
          'SELECT org_id, org_name FROM buxa_accept_invite($1)',
          [tokenHash],
        );

        return { orgId: rows[0].org_id, orgName: rows[0].org_name };
      });
    } catch (error) {
      const refusal = refusalOf(error);
      if (refusal) {
        throw new InviteRefusedError(refusal);
      }
      throw error;
    }
  }
}
