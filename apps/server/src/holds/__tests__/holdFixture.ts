import type { Pool } from 'pg';
import type { Db } from '../../people/pgRows';

/** A household with one child in it, for the hold tests (a hold is for a child of a household, migration 0055). */
export async function householdWithChild(
  db: Db,
  orgId: string,
  name: string,
): Promise<{ householdId: string; personId: string }> {
  const household = await db.query<{ id: string }>(
    `INSERT INTO households (org_id, name) VALUES ($1, $2) RETURNING id`,
    [orgId, name],
  );
  const householdId = household.rows[0].id;
  const person = await db.query<{ id: string }>(
    `INSERT INTO people (org_id, given_name, family_name) VALUES ($1, 'Child', $2) RETURNING id`,
    [orgId, name],
  );
  const personId = person.rows[0].id;
  await db.query(
    `INSERT INTO household_members (org_id, household_id, person_id, relationship) VALUES ($1, $2, $3, 'child')`,
    [orgId, householdId, personId],
  );

  return { householdId, personId };
}

/** A further child in an existing household (a sibling). */
export async function addSibling(db: Db, orgId: string, householdId: string, name: string): Promise<string> {
  const person = await db.query<{ id: string }>(
    `INSERT INTO people (org_id, given_name, family_name) VALUES ($1, $2, 'Sibling') RETURNING id`,
    [orgId, name],
  );
  await db.query(
    `INSERT INTO household_members (org_id, household_id, person_id, relationship) VALUES ($1, $2, $3, 'child')`,
    [orgId, householdId, person.rows[0].id],
  );

  return person.rows[0].id;
}

/**
 * Moves holds' expiry into the past without waiting for the clock. The request role cannot change an expiry (migration 0055) and
 * the guard trigger refuses it for everyone, so this runs as the test login with triggers off for the one statement.
 * `where` is a SQL condition over seat_holds with its parameters.
 */
export async function backdateHolds(pool: Pool, where: string, values: unknown[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL session_replication_role = replica');
    await client.query(`UPDATE seat_holds SET expires_at = now() - interval '1 minute' WHERE ${where}`, values);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
