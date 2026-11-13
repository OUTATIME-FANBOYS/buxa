import type { Pool } from 'pg';
import type { Role } from '../../../../packages/domain/src';
import { httpError } from '../http';
import type { Identity } from './verifier';

export interface User { id: string; email: string; name: string }
export interface Membership { orgId: string; role: Role; name: string; slug: string }

/**
 * Finds or creates our user for a verified identity. Linked by the provider's id, never by email,
 * so a new account can't take over an existing one by claiming its address.
 * Uses the privileged pool: signing in is the one cross-tenant lookup (a user's own memberships).
 */
export async function upsertUser(pool: Pool, who: Identity): Promise<User> {
  try {
    const r = await pool.query(
      `INSERT INTO users(auth_id, email, name) VALUES ($1, $2, $3)
       ON CONFLICT (auth_id) DO UPDATE SET email = EXCLUDED.email
       RETURNING id, email, name`, [who.authId, who.email, who.name]);
    return r.rows[0];
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw httpError(409, 'This email address is already linked to a different account');
    throw e;
  }
}

export async function membershipsOf(pool: Pool, userId: string): Promise<Membership[]> {
  const r = await pool.query(
    `SELECT m.org_id AS "orgId", m.role, o.name, o.slug
       FROM org_members m JOIN orgs o ON o.id = m.org_id
      WHERE m.user_id = $1 ORDER BY o.name`, [userId]);
  return r.rows;
}
