import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';
import type { Row } from '../types';

const url = process.env.DATABASE_URL;

// Migration 0021: the request role may update only orgs.name and orgs.timezone directly. archived_at is changed only by
// the owner-checked, audited functions (0013, 0017), which must keep working. Delete (0013) is covered too.
describe.skipIf(!url)('orgs update columns (0021)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(6).toString('hex');
  let owner = '';
  let admin = '';
  let camp = '';

  beforeAll(async () => {
    await migrate(pool);
    const users = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, 'Owner'), ($2, 'Admin') RETURNING id`,
      [`owner-${tag}@orgcols.test`, `admin-${tag}@orgcols.test`],
    );
    [owner, admin] = users.rows.map(r => r.id);
    camp = (
      await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ($1, $2) RETURNING id`, [
        `Cols ${tag}`,
        `orgcols-${tag}`,
      ])
    ).rows[0].id;
    await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'admin')`, [
      camp,
      owner,
      admin,
    ]);
  });

  afterAll(async () => {
    await pool.end();
  });

  const archivedAt = async () =>
    (await pool.query<{ archived_at: Date | null }>('SELECT archived_at FROM orgs WHERE id = $1', [camp])).rows[0]
      .archived_at;

  it('the request role has no table-wide UPDATE on orgs, only column-level UPDATE on name and timezone', async () => {
    const r = await pool.query<Row>(`SELECT
        has_table_privilege('buxa_app', 'orgs', 'UPDATE') AS table_update,
        has_column_privilege('buxa_app', 'orgs', 'name', 'UPDATE') AS name_update,
        has_column_privilege('buxa_app', 'orgs', 'timezone', 'UPDATE') AS timezone_update,
        has_column_privilege('buxa_app', 'orgs', 'archived_at', 'UPDATE') AS archived_update`);
    expect(r.rows[0]).toEqual({
      table_update: false,
      name_update: true,
      timezone_update: true,
      archived_update: false,
    });
  });

  it('a direct UPDATE of archived_at by the request role is refused, and archived_at stays null', async () => {
    await expect(
      withOrg(pool, camp, db => db.query('UPDATE orgs SET archived_at = now() WHERE id = $1', [camp])),
    ).rejects.toThrow(/permission denied for table orgs/);
    expect(await archivedAt()).toBeNull();
  });

  it('the request role can still rename the camp and change its timezone', async () => {
    const r = await withOrg(pool, camp, db =>
      db.query<Row>(`UPDATE orgs SET name = $1, timezone = $2 WHERE id = $3 RETURNING name, timezone`, [
        `Renamed ${tag}`,
        'Europe/London',
        camp,
      ]),
    );
    expect(r.rows[0]).toEqual({ name: `Renamed ${tag}`, timezone: 'Europe/London' });
  });

  it('the owner archives and unarchives through the functions, which still work', async () => {
    await withOrg(pool, camp, db => db.query('SELECT buxa_archive_camp($1, $2)', [camp, owner]));
    expect(await archivedAt()).not.toBeNull();
    await withOrg(pool, camp, db => db.query('SELECT buxa_unarchive_camp($1, $2)', [camp, owner]));
    expect(await archivedAt()).toBeNull();
  });

  it('the owner deletes the camp through the function, which still works', async () => {
    await withOrg(pool, camp, db => db.query('SELECT buxa_delete_camp($1, $2, $3)', [camp, owner, `Renamed ${tag}`]));
    const { rowCount } = await pool.query('SELECT id FROM orgs WHERE id = $1', [camp]);
    expect(rowCount).toBe(0);
  });
});
