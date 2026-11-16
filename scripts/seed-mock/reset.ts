import type pg from 'pg';
import { findCampId } from './camp';

/** How many rows a reset would delete from the mock camp. Everything else in the database is left alone. */
export interface ResetPlan { people: number; households: number; memberships: number; badges: number; checkIns: number }

interface CountRow { people: number; households: number; memberships: number; badges: number; check_ins: number }

/**
 * Counts the mock camp's rows before a reset, so the operator can see what will go. Null when the camp does not exist yet,
 * in which case there is nothing to delete.
 */
export async function planReset(pool: pg.Pool): Promise<ResetPlan | null> {
  const orgId = await findCampId(pool);
  if (orgId === null) return null;
  const { rows } = await pool.query<CountRow>(
    `SELECT (SELECT count(*) FROM people WHERE org_id = $1)::int AS people,
            (SELECT count(*) FROM households WHERE org_id = $1)::int AS households,
            (SELECT count(*) FROM memberships WHERE org_id = $1)::int AS memberships,
            (SELECT count(*) FROM credentials WHERE org_id = $1)::int AS badges,
            (SELECT count(*) FROM check_ins WHERE org_id = $1)::int AS check_ins`,
    [orgId]);
  const row = rows[0];
  if (!row) throw new Error('Could not count the camp rows.');
  return { people: row.people, households: row.households, memberships: row.memberships, badges: row.badges, checkIns: row.check_ins };
}
