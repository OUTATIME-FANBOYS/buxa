import type { Pool, PoolClient } from 'pg';
import { isUuid } from '@buxa/domain';
import { errorMessage } from './errors';

/**
 * Runs `work` in one transaction: committed if it returns, rolled back if it throws.
 * If the rollback itself fails, the connection may still be inside a transaction with the role switched, so it is
 * destroyed (released with an error) instead of returning to the pool, and the rollback failure is thrown with the
 * original error as its cause.
 */
export async function transaction<T>(pool: Pool, work: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  let result: T;
  try {
    await db.query('BEGIN');
    result = await work(db);
    await db.query('COMMIT');
  } catch (error) {
    try {
      await db.query('ROLLBACK');
    } catch (rollbackError) {
      db.release(rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError)));
      throw new Error(`Rollback failed and the database connection was discarded: ${errorMessage(rollbackError)}`, { cause: error });
    }
    db.release();
    throw error;
  }
  db.release();
  return result;
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
