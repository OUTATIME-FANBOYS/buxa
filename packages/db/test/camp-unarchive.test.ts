import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';
import type { Row } from '../types';

const url = process.env.DATABASE_URL;

// Migration 0017: unarchive (owner only, refused when the camp is not archived, audited, data unchanged). Delete of an
// archived camp (0013) is covered here too, because the owner can delete it straight from the archived list.
describe.skipIf(!url)('camp unarchive (0017)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(6).toString('hex');
  let owner = '';
  let admin = '';
  let camp = '';
  const NAME = `Unarchive ${tag}`;

  const unarchive = (actor: string) =>
    withOrg(pool, actor, camp, db => db.query('SELECT buxa_unarchive_camp($1)', [camp]));
  const archivedAt = async () =>
    (await pool.query<{ archived_at: Date | null }>('SELECT archived_at FROM orgs WHERE id = $1', [camp])).rows[0]
      .archived_at;

  beforeAll(async () => {
    await migrate(pool);
    const users = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, 'Owner'), ($2, 'Admin') RETURNING id`,
      [`owner-${tag}@unarchive.test`, `admin-${tag}@unarchive.test`],
    );
    [owner, admin] = users.rows.map(r => r.id);
    camp = (
      await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ($1, $2) RETURNING id`, [
        NAME,
        `unarchive-${tag}`,
      ])
    ).rows[0].id;
    await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'admin')`, [
      camp,
      owner,
      admin,
    ]);
    await pool.query(
      `INSERT INTO people (org_id, given_name, family_name, date_of_birth, phone) VALUES ($1, 'Ada', 'Lovelace', '1985-06-15', '+1 555 0100')`,
      [camp],
    );
    await withOrg(pool, owner, camp, db => db.query('SELECT buxa_archive_camp($1)', [camp]));
  });

  afterAll(async () => {
    await pool.end();
  });

  it('a non-owner cannot unarchive, and the camp stays archived', async () => {
    await expect(unarchive(admin)).rejects.toThrow(/Only the camp owner/);
    expect(await archivedAt()).not.toBeNull();
  });

  it('refuses an owner unarchive of a camp that is not archived, once it is active again', async () => {
    await unarchive(owner);
    expect(await archivedAt()).toBeNull();

    await expect(unarchive(owner)).rejects.toThrow(/not archived/);
  });

  it('the owner unarchives: the camp is active, its people are unchanged, and the audit row is written', async () => {
    await withOrg(pool, owner, camp, db => db.query('SELECT buxa_archive_camp($1)', [camp]));
    const auditRows = () =>
      pool.query<Row>(`SELECT action FROM audit_log WHERE org_id = $1 AND action = 'org.unarchive'`, [camp]);
    const before = (await auditRows()).rowCount ?? 0;
    await unarchive(owner);

    expect(await archivedAt()).toBeNull();
    expect((await pool.query('SELECT 1 FROM people WHERE org_id = $1', [camp])).rowCount).toBe(1);
    const memberships = await withOrg(pool, owner, null, db =>
      db.query<{ orgId: string }>('SELECT member_org_id AS "orgId" FROM buxa_memberships_of()', []),
    );
    expect(memberships.rows.map(m => m.orgId)).toContain(camp);
    expect((await auditRows()).rowCount).toBe(before + 1);
  });

  it('the owner deletes an archived camp with its exact name', async () => {
    await withOrg(pool, owner, camp, db => db.query('SELECT buxa_archive_camp($1)', [camp]));

    await withOrg(pool, owner, camp, db => db.query('SELECT buxa_delete_camp($1, $2)', [camp, NAME]));

    expect((await pool.query('SELECT 1 FROM orgs WHERE id = $1', [camp])).rowCount).toBe(0);
  });
});
