/**
 * Seeds "Camp Birchwood", a fictional camp, into the LOCAL database. Run with `npm run seed:mock`, or `npm run seed:reset` to
 * delete the camp's rows and seed them again.
 *
 *   --reset               delete the camp's people, households, memberships, badges and check-ins, then rebuild them (asks first)
 *   --yes                 answer the reset question yes, for a run without a terminal
 *   --owner-email=<e>     make an existing account (one that has signed in once) the camp owner
 *   --admin-email=<e>     likewise for the admin, --staff-email= for staff, --viewer-email= for the viewer
 *
 * Without the email flags the seed creates fictional accounts (example.com), which cannot sign in. The developer's account
 * becomes an owner of the camp: SEED_OWNER_EMAIL (in apps/web/.env.local) names it, or else the one real account is used.
 * Refuses any database that is not on localhost. Never prints DATABASE_URL.
 */
import pg from 'pg';
import { assertLocalDatabase } from './seed-mock/guard';
import type { SeedOptions } from './seed-mock/run';
import type { ClassSeedResult } from './seed-mock/classes';

const FLAGS: Record<string, keyof Omit<SeedOptions, 'reset'>> = {
  '--owner-email': 'owner',
  '--admin-email': 'admin',
  '--staff-email': 'staff',
  '--viewer-email': 'viewer',
};

export interface CliOptions extends SeedOptions {
  yes: boolean;
}

export function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = { reset: false, yes: false };
  for (const arg of argv) {
    if (arg === '--reset') {
      options.reset = true;
      continue;
    }
    if (arg === '--yes') {
      options.yes = true;
      continue;
    }
    const [flag, value] = arg.split('=', 2);
    const key = FLAGS[flag];
    if (key === undefined || value === undefined || value === '') {
      throw new Error(`Unknown or incomplete option: ${flag}`);
    }
    options[key] = value;
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  assertLocalDatabase(process.env.DATABASE_URL);
  // Loaded only after the guard, so a refusal never touches the app's server code.
  const { seedMock } = await import('./seed-mock/run');
  const { planReset } = await import('./seed-mock/reset');
  const { describeReset } = await import('./seed-mock/resetText');
  const { confirmReset } = await import('./seed-mock/confirm');
  options.developerEmail = process.env.SEED_OWNER_EMAIL || undefined;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  try {
    if (options.reset) {
      const plan = await planReset(pool);
      if (plan !== null) {
        console.log(describeReset(plan));
        if (!options.yes && !(await confirmReset())) {
          console.log('Not confirmed. Nothing was deleted. (Without a terminal, pass --yes.)');
          process.exitCode = 1;

          return;
        }
      }
    }
    const result = await seedMock(pool, options);
    if (result.status === 'already-seeded') {
      console.log('Camp Birchwood is already seeded. Run `npm run seed:reset` to clear and rebuild it.');
    } else {
      const c = result.counts;
      console.log(
        `Camp Birchwood seeded: ${c.people} people, ${c.households} households, ${c.memberships} memberships, ${c.badges} badges, ${c.checkIns} check-ins.`,
      );
    }
    console.log(describeClasses(result.classes));
  } finally {
    await pool.end();
  }
}

/** The class seed's report: what the run created, and what the seeded rows now total. */
export function describeClasses(r: ClassSeedResult): string {
  const t = r.totals;
  const owner =
    r.ownerEmail === null
      ? 'Developer owner: none chosen (set SEED_OWNER_EMAIL).'
      : `Developer owner: ${r.ownerEmail} (from ${r.ownerSource}).`;

  return [
    `Classes: ${t.sessions} sessions, ${t.classes} classes, ${t.teachers} teacher, ${t.teacherAssignments} teacher assignment, ${t.enrolled} enrolled, ${t.waitlisted} waitlisted.`,
    owner,
    `Created this run: ${r.created}.`,
  ].join('\n');
}

// Only run when executed directly, so the argument parser can be tested.
if (process.argv[1]?.endsWith('seed-mock.ts')) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
