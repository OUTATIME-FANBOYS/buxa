import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import { errorMessage } from './errors';

/** The .sql files live next to this package. */
const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/** Applies any migration files not yet recorded, in filename order, each in its own transaction. */
export async function migrate(pool: Pool): Promise<string[]> {
  const c = await pool.connect();
  const applied: string[] = [];
  try {
    await c.query('SELECT pg_advisory_lock(727274)'); // two deploys must not migrate at once
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await c.query('SELECT name FROM schema_migrations')).rows.map(r => r.name));
    for (const file of readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()) {
      if (done.has(file)) continue;
      try {
        await c.query('BEGIN');
        await c.query(readFileSync(join(DIR, file), 'utf8'));
        await c.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
        await c.query('COMMIT');
        applied.push(file);
      } catch (e) { await c.query('ROLLBACK'); throw new Error(`Migration ${file} failed: ${errorMessage(e)}`); }
    }
  } finally { await c.query('SELECT pg_advisory_unlock(727274)').catch(() => {}); c.release(); }
  return applied;
}
