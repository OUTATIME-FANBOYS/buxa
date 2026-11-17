import type { Pool } from 'pg';

/**
 * Resolves once a session of this pool (its `application_name`) is waiting on a lock. Race tests hold one transaction
 * open, start the real repository call behind it, and wait here until that call is blocked, so the interleaving is fixed
 * rather than left to timing. Other test files run in parallel on the same database, so the count is scoped to this pool.
 */
export async function untilBlocked(pool: Pool, applicationName: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_stat_activity
        WHERE wait_event_type = 'Lock' AND datname = current_database() AND application_name = $1`, [applicationName]);
    if (rows[0].n > 0) {
      return;
    }
    if (Date.now() > deadline) {
      throw new Error('no session started waiting on a lock');
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
