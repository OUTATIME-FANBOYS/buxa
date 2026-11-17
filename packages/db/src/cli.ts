import pg from 'pg';
import { migrate } from './migrate';
import { poolConfigFor } from './connection';

// Migrations use a direct connection when one is given (a transaction-mode connection pooler cannot hold the advisory lock).
const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL (or MIGRATION_DATABASE_URL) is not set (see .env.example)'); process.exit(1); }
const pool = new pg.Pool(poolConfigFor(url));
migrate(pool).then(applied => { console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Up to date'); return pool.end(); })
  .catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
