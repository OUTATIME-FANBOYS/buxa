import pg from 'pg';
import { migrate, migrationDatabaseUrl } from './migrate';
import { poolConfigFor } from './connection';
import { errorMessage } from './errors';

// Migrations run only as the migration login (MIGRATION_DATABASE_URL). DATABASE_URL, the app's restricted login, is never used here.
let url: string;
try {
  url = migrationDatabaseUrl(process.env);
} catch (error) {
  console.error(errorMessage(error));
  process.exit(1);
}
// A direct connection is preferred (a transaction-mode connection pooler cannot hold the advisory lock).
const pool = new pg.Pool(poolConfigFor(url));
migrate(pool)
  .then(applied => {
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Up to date');

    return pool.end();
  })
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
