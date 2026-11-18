import type { Pool } from 'pg';
import type { Membership, User } from '@buxa/contracts';
import { isUniqueViolation, withOrg } from '@buxa/db';
import type { Identity } from '../auth/identity';
import { EmailInUseError, type UserRepository } from './UserRepository';

/**
 * Signing in needs two lookups row-level security cannot scope (no organisation is known yet, or the lookup spans all of
 * them). Both are SECURITY DEFINER functions (migration 0009), called as the request role with no organisation set, so
 * this adapter never uses a login that bypasses row-level security. See docs/security.md, section 2.
 */
export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async upsertFromIdentity(identity: Identity): Promise<User> {
    try {
      const { rows } = await withOrg(this.pool, null, db =>
        db.query<User>(
          'SELECT user_id AS id, user_email AS email, user_name AS name FROM buxa_upsert_user($1, $2, $3)',
          [identity.authId, identity.email, identity.name],
        ),
      );

      return rows[0];
    } catch (error) {
      throw isUniqueViolation(error) ? new EmailInUseError() : error;
    }
  }

  membershipsOf(userId: string): Promise<Membership[]> {
    return withOrg(this.pool, null, async db => {
      const { rows } = await db.query<Membership>(
        'SELECT member_org_id AS "orgId", member_role AS role, org_name AS name, org_slug AS slug FROM buxa_memberships_of($1)',
        [userId],
      );

      return rows;
    });
  }

  async updateName(userId: string, name: string): Promise<User> {
    const { rows } = await withOrg(this.pool, null, db =>
      db.query<User>('SELECT user_id AS id, user_email AS email, user_name AS name FROM buxa_set_user_name($1, $2)', [
        userId,
        name,
      ]),
    );
    if (!rows[0]) {
      throw new Error('no user to rename');
    }

    return rows[0];
  }

  archivedMembershipsOf(userId: string): Promise<Membership[]> {
    return withOrg(this.pool, null, async db => {
      const { rows } = await db.query<Membership>(
        'SELECT member_org_id AS "orgId", member_role AS role, org_name AS name, org_slug AS slug FROM buxa_archived_memberships_of($1)',
        [userId],
      );

      return rows;
    });
  }
}
