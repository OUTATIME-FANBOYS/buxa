import type { Pool } from 'pg';
import type { ClockFormat, Membership, User } from '@buxa/contracts';
import { isUniqueViolation, withOrg } from '@buxa/db';
import type { Actor, MemberOption } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import type { Identity } from '../auth/identity';
import { EmailInUseError, type UserRepository } from './UserRepository';

/**
 * Signing in needs two lookups row-level security cannot scope (no organisation is known yet, or the lookup spans all of
 * them). Both are SECURITY DEFINER functions (migration 0009), called as the request role with no organisation set, so
 * this adapter never uses a login that bypasses row-level security. See docs/security.md, section 2.
 */
/** The columns every user read returns, with the names the User type uses. The SQL functions return the same columns. */
const USER_COLUMNS = `user_id AS id, user_email AS email, user_name AS name, user_first_name AS "firstName",
  user_last_name AS "lastName", user_clock_format AS "clockFormat"`;

export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async upsertFromIdentity(identity: Identity): Promise<User> {
    try {
      const { rows } = await withOrg(this.pool, null, null, db =>
        db.query<User>(`SELECT ${USER_COLUMNS} FROM buxa_upsert_user($1, $2, $3)`, [
          identity.authId,
          identity.email,
          identity.name,
        ]),
      );

      return rows[0];
    } catch (error) {
      throw isUniqueViolation(error) ? new EmailInUseError() : error;
    }
  }

  membershipsOf(userId: string): Promise<Membership[]> {
    return withOrg(this.pool, userId, null, async db => {
      const { rows } = await db.query<Membership>(
        'SELECT member_org_id AS "orgId", member_role AS role, org_name AS name, org_slug AS slug FROM buxa_memberships_of()',
      );

      return rows;
    });
  }

  async updateName(userId: string, name: { firstName: string; lastName: string | null }): Promise<User> {
    const { rows } = await withOrg(this.pool, userId, null, db =>
      db.query<User>(`SELECT ${USER_COLUMNS} FROM buxa_set_user_name($1, $2)`, [name.firstName, name.lastName]),
    );
    if (!rows[0]) {
      throw new Error('no user to rename');
    }

    return rows[0];
  }

  async setClockFormat(userId: string, clockFormat: ClockFormat): Promise<User> {
    const { rows } = await withOrg(this.pool, userId, null, db =>
      db.query<User>(`SELECT ${USER_COLUMNS} FROM buxa_set_user_clock_format($1)`, [clockFormat]),
    );
    if (!rows[0]) {
      throw new Error('no user to update');
    }

    return rows[0];
  }

  async roleIn(userId: string, orgId: string, memberId: string): Promise<Membership['role'] | null> {
    const { rows } = await withOrg(this.pool, userId, orgId, db =>
      db.query<{ role: Membership['role'] }>('SELECT role FROM org_members WHERE user_id = $1', [memberId]),
    );

    return rows[0]?.role ?? null;
  }

  renameMember(actor: Actor, userId: string, name: string): Promise<Pick<User, 'id' | 'email' | 'name'> | null> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      const { rows } = await db.query<Pick<User, 'id' | 'email' | 'name'>>(
        'SELECT user_id AS id, user_email AS email, user_name AS name FROM buxa_rename_member($1, $2, $3)',
        [actor.orgId, userId, name],
      );
      if (!rows[0]) {
        return null;
      }
      await recordAudit(db, { actor, action: 'member.rename', entity: 'user', entityId: userId, data: { name } });

      return rows[0];
    });
  }

  memberOptionsOf(viewerId: string, orgId: string, memberId: string): Promise<MemberOption[]> {
    return withOrg(this.pool, viewerId, orgId, async db => {
      const { rows } = await db.query<{ option_key: MemberOption }>(
        'SELECT option_key FROM member_options WHERE user_id = $1 AND enabled',
        [memberId],
      );

      return rows.map(r => r.option_key);
    });
  }

  memberOptionsIn(viewerId: string, orgId: string): Promise<{ userId: string; option: MemberOption }[]> {
    return withOrg(this.pool, viewerId, orgId, async db => {
      const { rows } = await db.query<{ user_id: string; option_key: MemberOption }>(
        'SELECT user_id, option_key FROM member_options WHERE enabled',
      );

      return rows.map(r => ({ userId: r.user_id, option: r.option_key }));
    });
  }

  setMemberOption(actor: Actor, userId: string, option: MemberOption, enabled: boolean): Promise<void> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      await db.query('SELECT buxa_set_member_option($1, $2, $3, $4, $5)', [
        actor.orgId,
        userId,
        option,
        enabled,
        actor.userId,
      ]);
      await recordAudit(db, {
        actor,
        action: 'member.option_set',
        entity: 'user',
        entityId: userId,
        data: { option, enabled },
      });
    });
  }

  archivedMembershipsOf(userId: string): Promise<Membership[]> {
    return withOrg(this.pool, userId, null, async db => {
      const { rows } = await db.query<Membership>(
        'SELECT member_org_id AS "orgId", member_role AS role, org_name AS name, org_slug AS slug FROM buxa_archived_memberships_of()',
      );

      return rows;
    });
  }
}
