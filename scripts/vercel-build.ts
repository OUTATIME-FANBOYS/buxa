/**
 * Vercel's build command for this project (see apps/web/vercel.json).
 *
 * A PRODUCTION build applies pending database migrations first. That happens before the new version can serve, and a failure fails the
 * build, so the previous deployment keeps serving. PREVIEW builds never touch the schema: their environment has no migration credential.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { errorMessage, migrate } from '@buxa/db';

const webDir = fileURLToPath(new URL('../apps/web', import.meta.url));
const env = (name: string) => process.env[name]?.trim() || undefined;

async function applyMigrations(): Promise<void> {
  if (env('VERCEL_ENV') !== 'production') { console.log('Migrations: skipped (only production builds change the database schema)'); return; }
  const url = env('MIGRATION_DATABASE_URL') ?? env('DATABASE_URL');
  if (!url) throw new Error('A production build needs MIGRATION_DATABASE_URL (or DATABASE_URL) to apply database migrations.');
  const pool = new pg.Pool({ connectionString: url });
  try {
    const applied = await migrate(pool);
    console.log(applied.length ? `Migrations applied: ${applied.join(', ')}` : 'Migrations: up to date');
  } finally { await pool.end(); }
}

async function main(): Promise<void> {
  await applyMigrations();
  const build = spawnSync('npx', ['next', 'build'], { cwd: webDir, stdio: 'inherit' });
  if (build.status !== 0) throw new Error('next build failed.');
}

main().catch(error => { console.error(errorMessage(error)); process.exit(1); });
