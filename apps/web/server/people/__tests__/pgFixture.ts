import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import type { Actor } from '@buxa/domain';
import { createPgRepositories } from '../../repositories';
import type { RepositoryFixture } from './fixture';

async function insertOrg(pool: Pool, slug: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO orgs (name, slug, timezone) VALUES ('Test camp', $1, 'Europe/London') RETURNING id`, [slug]);
  return rows[0].id;
}

async function insertUser(pool: Pool, email: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(`INSERT INTO users (email, name) VALUES ($1, 'Test staff') RETURNING id`, [email]);
  return rows[0].id;
}

/**
 * A fresh pair of organisations with random slugs, and one user in each. Rows are written through the real adapters, so
 * row-level security and the audit entries are exercised exactly as in production.
 * Cleanup is best effort: audit_log is append-only (by design), so an organisation that has audit rows cannot be deleted.
 */
export async function createPgFixture(pool: Pool): Promise<RepositoryFixture> {
  const tag = randomBytes(6).toString('hex');
  const orgA = await insertOrg(pool, `contract-a-${tag}`);
  const orgB = await insertOrg(pool, `contract-b-${tag}`);
  const userA = await insertUser(pool, `staff-a-${tag}@example.test`);
  const userB = await insertUser(pool, `staff-b-${tag}@example.test`);
  const actor: Actor = { userId: userA, orgId: orgA, role: 'owner' };
  const otherActor: Actor = { userId: userB, orgId: orgB, role: 'owner' };
  return {
    repos: createPgRepositories(pool),
    actor,
    otherActor,
    auditActions: () => withOrg(pool, orgA, async db => {
      const { rows } = await db.query<{ action: string }>('SELECT action FROM audit_log ORDER BY id');
      return rows.map(r => r.action);
    }),
    close: async () => {
      await pool.query('DELETE FROM orgs WHERE id = ANY($1::uuid[])', [[orgA, orgB]]).catch(() => undefined);
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[userA, userB]]).catch(() => undefined);
    },
  };
}
