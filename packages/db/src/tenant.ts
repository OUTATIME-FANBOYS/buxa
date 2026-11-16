import type { Pool, PoolClient } from 'pg';
import { isUuid } from '@buxa/domain';

/** Runs `work` in one transaction: committed if it returns, rolled back if it throws. */
export async function transaction<T>(pool: Pool, work: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const result = await work(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {}); // keep the original error, not a rollback failure
    throw error;
  } finally {
    db.release();
  }
}

/**
 * The only way request code touches tenant data: a transaction run as the restricted `buxa_app` role with the
 * organisation fixed, so row-level security decides what is visible. With no org (null) every tenant table reads as empty.
 */
export function withOrg<T>(pool: Pool, orgId: string | null, work: (db: PoolClient) => Promise<T>): Promise<T> {
  if (orgId !== null && !isUuid(orgId)) return Promise.reject(new Error('Invalid organisation id'));
  return transaction(pool, async db => {
    await db.query('SET LOCAL ROLE buxa_app');
    await db.query("SELECT set_config('app.org_id', $1, true)", [orgId ?? '']);
    return work(db);
  });
}
