import { randomBytes } from 'node:crypto';
import type pg from 'pg';

/**
 * A new signed-in user with a role in the camp, for tests that go through withOrg. Row-level security (migration 0032)
 * shows a camp only to a user who is a member of it, so a test that reads or writes a camp needs one.
 */
export async function memberOf(
  pool: pg.Pool,
  org: string,
  role: 'owner' | 'admin' | 'staff' | 'viewer' | 'teacher' = 'owner',
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (email, name) VALUES ($1, 'Test') RETURNING id`,
    [`member-${randomBytes(6).toString('hex')}@test.test`],
  );
  // The teacher level is retired (migration 0069): a "teacher" is a viewer whose person holds the instructor role.
  const access = role === 'teacher' ? 'viewer' : role;
  await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, $3)`, [org, rows[0].id, access]);
  if (role === 'teacher') {
    const { rows: person } = await pool.query<{ id: string }>(
      `INSERT INTO people (org_id, given_name, family_name, user_id, date_of_birth, phone) VALUES ($1, 'Tess', 'Teacher', $2, '1985-06-15', '+1 555 0100') RETURNING id`,
      [org, rows[0].id],
    );
    await pool.query(`INSERT INTO person_roles (org_id, person_id, role) VALUES ($1, $2, 'instructor')`, [
      org,
      person[0].id,
    ]);
  }

  return rows[0].id;
}
