/**
 * Seeds "Camp Birchwood", a fictional camp, into the LOCAL database. Run with `npm run seed:mock`.
 *
 *   --reset               clear the camp's people, households, memberships, badges and visits, then rebuild them
 *   --owner-email=<e>     make an existing account (one that has signed in once) the camp owner
 *   --admin-email=<e>     likewise for the admin, --staff-email= for staff, --viewer-email= for the viewer
 *
 * Without the email flags the seed creates fictional accounts (example.com), which cannot sign in. Refuses any database that
 * is not on localhost. Never prints DATABASE_URL.
 */
import pg from 'pg';
import { assertLocalDatabase } from './seed-mock/guard';
import type { SeedOptions } from './seed-mock/run';

const FLAGS: Record<string, keyof Omit<SeedOptions, 'reset'>> = {
  '--owner-email': 'owner', '--admin-email': 'admin', '--staff-email': 'staff', '--viewer-email': 'viewer',
};

export function parseArgs(argv: readonly string[]): SeedOptions {
  const options: SeedOptions = { reset: false };
  for (const arg of argv) {
    if (arg === '--reset') { options.reset = true; continue; }
    const [flag, value] = arg.split('=', 2);
    const key = FLAGS[flag];
    if (key === undefined || value === undefined || value === '') throw new Error(`Unknown or incomplete option: ${flag}`);
    options[key] = value;
  }
  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  assertLocalDatabase(process.env.DATABASE_URL);
  // Loaded only after the guard, so a refusal never touches the app's server code.
  const { seedMock } = await import('./seed-mock/run');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  try {
    const result = await seedMock(pool, options);
    if (result.status === 'already-seeded') {
      console.log('Camp Birchwood is already seeded. Run with --reset to clear and rebuild it.');
      return;
    }
    const c = result.counts;
    console.log(`Camp Birchwood seeded: ${c.people} people, ${c.households} households, ${c.memberships} memberships, ${c.badges} badges, ${c.checkIns} check-ins.`);
  } finally {
    await pool.end();
  }
}

// Only run when executed directly, so the argument parser can be tested.
if (process.argv[1]?.endsWith('seed-mock.ts')) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
