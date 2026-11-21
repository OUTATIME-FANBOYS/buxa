import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';
import { memberOf } from './support';

// Migration 0036: only an admin or the owner may change the camp's name or time zone, at the database as well as in the app.
// These need a real Postgres (DATABASE_URL).
const url = process.env.DATABASE_URL;

describe.skipIf(!url)('org update needs an admin or owner (migration 0036)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(6).toString('hex');
  let org = '';

  beforeAll(async () => {
    await migrate(pool);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO orgs (name, slug, timezone) VALUES ('Role camp', $1, 'UTC') RETURNING id`,
      [`role-${tag}`],
    );
    org = rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  const renameAs = async (userId: string, name: string): Promise<number> => {
    const result = await withOrg(pool, userId, org, db =>
      db.query(`UPDATE orgs SET name = $1 WHERE id = $2`, [name, org]),
    );

    return result.rowCount ?? 0;
  };

  it('an owner and an admin can change the name', async () => {
    const owner = await memberOf(pool, org, 'owner');
    const admin = await memberOf(pool, org, 'admin');

    expect(await renameAs(owner, `Owner ${tag}`)).toBe(1);
    expect(await renameAs(admin, `Admin ${tag}`)).toBe(1);
  });

  it('staff, a teacher and a viewer cannot change the name, and the row is unchanged', async () => {
    const staff = await memberOf(pool, org, 'staff');
    const teacher = await memberOf(pool, org, 'teacher');
    const viewer = await memberOf(pool, org, 'viewer');

    expect(await renameAs(staff, 'Staff rename')).toBe(0);
    expect(await renameAs(teacher, 'Teacher rename')).toBe(0);
    expect(await renameAs(viewer, 'Viewer rename')).toBe(0);

    const { rows } = await pool.query<{ name: string }>(`SELECT name FROM orgs WHERE id = $1`, [org]);
    expect(rows[0].name).toBe(`Admin ${tag}`);
  });

  it('a user who is not a member of the camp cannot change it', async () => {
    const outsider = await memberOf(pool, await otherCamp(pool, tag), 'owner');

    expect(await renameAs(outsider, 'Outsider rename')).toBe(0);
  });
});

async function otherCamp(pool: pg.Pool, tag: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO orgs (name, slug, timezone) VALUES ('Other camp', $1, 'UTC') RETURNING id`,
    [`other-${tag}`],
  );

  return rows[0].id;
}
