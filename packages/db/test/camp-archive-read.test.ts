import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';

const url = process.env.DATABASE_URL;

// Migration 0014: buxa_archived_memberships_of, the read-only list that lets a person open an archived camp. The write-side list
// (buxa_memberships_of, 0013) must still leave archived camps out.
describe.skipIf(!url)('viewing an archived camp (0014)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(6).toString('hex');
  let member = '';
  let archivedCamp = '';
  let activeCamp = '';

  beforeAll(async () => {
    await migrate(pool);
    const user = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, 'Member') RETURNING id`,
      [`member-${tag}@archive-read.test`],
    );
    member = user.rows[0].id;
    const archived = await pool.query<{ id: string }>(
      `INSERT INTO orgs (name, slug, archived_at) VALUES ($1, $2, now()) RETURNING id`,
      [`Old Camp ${tag}`, `old-camp-${tag}`],
    );
    archivedCamp = archived.rows[0].id;
    const active = await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ($1, $2) RETURNING id`, [
      `New Camp ${tag}`,
      `new-camp-${tag}`,
    ]);
    activeCamp = active.rows[0].id;
    await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $3, 'staff'), ($2, $3, 'viewer')`, [
      archivedCamp,
      activeCamp,
      member,
    ]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('lists the archived camp, with its slug and the role, and not the active camp', async () => {
    const { rows } = await withOrg(pool, member, null, db =>
      db.query<{ orgId: string; role: string; slug: string }>(
        'SELECT member_org_id AS "orgId", member_role AS role, org_slug AS slug FROM buxa_archived_memberships_of()',
      ),
    );

    expect(rows).toEqual([{ orgId: archivedCamp, role: 'staff', slug: `old-camp-${tag}` }]);
  });

  it('the write-side list still leaves the archived camp out', async () => {
    const { rows } = await withOrg(pool, member, null, db =>
      db.query<{ orgId: string }>('SELECT member_org_id AS "orgId" FROM buxa_memberships_of()'),
    );

    expect(rows.map(r => r.orgId)).toEqual([activeCamp]);
  });
});
