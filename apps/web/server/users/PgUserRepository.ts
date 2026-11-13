import type { Pool } from 'pg';
import type { Membership, User } from '@buxa/contracts';
import { isUniqueViolation } from '@buxa/db';
import type { Identity } from '../auth/identity';
import { EmailInUseError, type UserRepository } from './UserRepository';

/**
 * Signing in is the one cross-tenant lookup (a person's own memberships), so this adapter uses the privileged pool.
 * Everything else goes through withOrg(). See docs/auth.md, "Known limits".
 */
export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async upsertFromIdentity(identity: Identity): Promise<User> {
    try {
      const result = await this.pool.query<User>(
        `INSERT INTO users(auth_id, email, name) VALUES ($1, $2, $3)
         ON CONFLICT (auth_id) DO UPDATE SET email = EXCLUDED.email
         RETURNING id, email, name`,
        [identity.authId, identity.email, identity.name]);
      return result.rows[0];
    } catch (error) {
      throw isUniqueViolation(error) ? new EmailInUseError() : error;
    }
  }

  async membershipsOf(userId: string): Promise<Membership[]> {
    const result = await this.pool.query<Membership>(
      `SELECT m.org_id AS "orgId", m.role, o.name, o.slug
         FROM org_members m JOIN orgs o ON o.id = m.org_id
        WHERE m.user_id = $1 ORDER BY o.name`, [userId]);
    return result.rows;
  }
}
