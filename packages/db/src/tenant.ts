import type { Pool, PoolClient } from 'pg';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The only way request code touches tenant data: runs `fn` in a transaction as the restricted
 * `buxa_app` role with the organisation fixed, so row-level security decides what is visible.
 * With no org (null) every tenant table reads as empty.
 */
export async function withOrg<T>(pool: Pool, orgId: string | null, fn: (db: PoolClient) => Promise<T>): Promise<T> {
  if (orgId !== null && !UUID.test(orgId)) throw new Error('Invalid organisation id');
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('SET LOCAL ROLE buxa_app');
    await db.query("SELECT set_config('app.org_id', $1, true)", [orgId ?? '']);
    const out = await fn(db);
    await db.query('COMMIT');
    return out;
  } catch (e) { await db.query('ROLLBACK').catch(() => {}); throw e; }
  finally { db.release(); }
}
