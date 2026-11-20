import type pg from 'pg';
import { createPgRepositories } from '@buxa/server/repositories';
import { createServices } from '@buxa/server/runtime';
import { actorsFor, createCamp, findCampId, resetCamp, type AccountChoice } from './camp';
import { seedRoster, type RosterCounts } from './people';
import { seedVisits } from './visits';
import { seedClasses, type ClassSeedResult } from './classes';

export interface SeedOptions extends AccountChoice {
  reset: boolean;
  /** The developer's account email, from SEED_OWNER_EMAIL. Made an owner of the camp. */
  developerEmail?: string;
}

const ACCOUNT_KEYS: (keyof AccountChoice)[] = ['owner', 'admin', 'staff', 'viewer'];

export type SeedResult =
  | { status: 'already-seeded'; classes: ClassSeedResult }
  | { status: 'seeded'; counts: RosterCounts & { checkIns: number }; classes: ClassSeedResult };

/** How many people the camp has. A camp with none is treated as not seeded, so a failed run can simply be run again. */
async function peopleCount(pool: pg.Pool, orgId: string): Promise<number> {
  const { rows } = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM people WHERE org_id = $1', [orgId]);

  return rows[0].n;
}

/**
 * Seeds Camp Birchwood through the services (so the app's audit rows are written). Idempotent: when the camp already has people,
 * it does nothing unless `reset` is set, in which case the camp's people, households and visits are cleared and rebuilt.
 * If seeding fails partway, the partial rows are cleared before the error is rethrown.
 */
export async function seedMock(pool: pg.Pool, options: SeedOptions, now: Date = new Date()): Promise<SeedResult> {
  const existing = await findCampId(pool);
  if (existing !== null && ACCOUNT_KEYS.some(key => options[key] !== undefined)) {
    throw new Error(
      'The account options only apply when the camp is first created. Drop them, or drop the camp to choose new accounts.',
    );
  }
  let at = now;
  const repos = createPgRepositories(pool);
  const services = createServices(repos, () => new Date(at.getTime()));
  if (existing !== null && !options.reset && (await peopleCount(pool, existing)) > 0) {
    const actors = await actorsFor(pool, existing);
    const classes = await seedClasses(pool, repos, services, actors.owner, options.developerEmail);

    return { status: 'already-seeded', classes };
  }

  const orgId = existing ?? (await createCamp(pool, services, repos, options));
  try {
    await resetCamp(pool, orgId);
    const actors = await actorsFor(pool, orgId);
    const { ids, counts } = await seedRoster(services, actors.owner, now.getUTCFullYear());
    const checkIns = await seedVisits(services, actors.staff, ids, now, time => {
      at = time;
    });
    const classes = await seedClasses(pool, repos, services, actors.owner, options.developerEmail);

    return { status: 'seeded', counts: { ...counts, checkIns }, classes };
  } catch (error) {
    await resetCamp(pool, orgId).catch(() => undefined);
    throw error;
  }
}
