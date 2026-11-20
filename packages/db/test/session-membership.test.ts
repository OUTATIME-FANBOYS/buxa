import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';
import type { Row } from '../types';

const url = process.env.DATABASE_URL;

// Migration 0032 (audit items 5.1 and 5.3). The policies require the signed-in user to be a member of the camp, and the
// owner-rights functions take the user from the session, so a caller with no membership, or a lower role, gets nothing.
describe.skipIf(!url)('session membership (0032)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(6).toString('hex');
  let camp = '';
  let otherCamp = '';
  let owner = '';
  let admin = '';
  let viewer = '';
  let outsider = '';
  let target = '';
  let person = '';

  const asUser = <T>(user: string | null, org: string | null, work: (db: pg.PoolClient) => Promise<T>) =>
    withOrg(pool, user, org, work);

  beforeAll(async () => {
    await migrate(pool);
    const user = async (label: string) =>
      (
        await pool.query<{ id: string }>(`INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id`, [
          `${label}-${tag}@membership.test`,
          label,
        ])
      ).rows[0].id;
    const org = async (name: string) =>
      (
        await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ($1, $2) RETURNING id`, [
          `${name} ${tag}`,
          `${name.toLowerCase()}-${tag}`,
        ])
      ).rows[0].id;
    camp = await org('Membership');
    otherCamp = await org('Elsewhere');
    owner = await user('owner');
    admin = await user('admin');
    viewer = await user('viewer');
    target = await user('target');
    outsider = await user('outsider');
    await pool.query(
      `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'admin'), ($1, $4, 'viewer'), ($1, $5, 'staff')`,
      [camp, owner, admin, viewer, target],
    );
    // The outsider belongs to another camp only.
    await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner')`, [otherCamp, outsider]);
    person = (
      await pool.query<{ id: string }>(
        `INSERT INTO people (org_id, given_name, family_name) VALUES ($1, 'Ada', 'Lovelace') RETURNING id`,
        [camp],
      )
    ).rows[0].id;
    await pool.query(
      `INSERT INTO memberships (org_id, person_id, plan, starts_on, ends_on) VALUES ($1, $2, 'Week', '2026-07-01', '2026-07-07')`,
      [camp, person],
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM orgs WHERE id = ANY($1)', [[camp, otherCamp]]).catch(() => undefined);
    await pool
      .query('DELETE FROM users WHERE id = ANY($1)', [[owner, admin, viewer, target, outsider]])
      .catch(() => undefined);
    await pool.end();
  });

  const campName = async () =>
    (await pool.query<{ name: string }>('SELECT name FROM orgs WHERE id = $1', [camp])).rows[0].name;
  const archivedAt = async () =>
    (await pool.query<{ archived_at: Date | null }>('SELECT archived_at FROM orgs WHERE id = $1', [camp])).rows[0]
      .archived_at;

  describe('a user with no membership sees nothing', () => {
    // Contract step (packages/db/migrations/0034): the policies require a signed-in member only after v0.2.3 is retired.
    it.skip('reads no org_members and no memberships of a camp they do not belong to', async () => {
      const seen = await asUser(outsider, camp, async db => ({
        members: (await db.query<Row>('SELECT 1 FROM org_members')).rowCount,
        memberships: (await db.query<Row>('SELECT 1 FROM memberships')).rowCount,
        orgs: (await db.query<Row>('SELECT 1 FROM orgs')).rowCount,
        users: (await db.query<Row>('SELECT 1 FROM users')).rowCount,
      }));
      expect(seen).toEqual({ members: 0, memberships: 0, orgs: 0, users: 0 });
    });

    it('a member of the camp sees its own members and memberships', async () => {
      const seen = await asUser(owner, camp, async db => ({
        members: (await db.query<Row>('SELECT 1 FROM org_members')).rowCount,
        memberships: (await db.query<Row>('SELECT 1 FROM memberships')).rowCount,
      }));
      expect(seen.members).toBe(4);
      expect(seen.memberships).toBe(1);
    });

    // Contract step (packages/db/migrations/0034): the policies require a signed-in member only after v0.2.3 is retired.

    it.skip('with no user set, even the right camp reads nothing', async () => {
      const seen = await asUser(null, camp, async db => (await db.query<Row>('SELECT 1 FROM org_members')).rowCount);
      expect(seen).toBe(0);
    });

    it('with no camp set, a member reads nothing', async () => {
      const seen = await asUser(owner, null, async db => (await db.query<Row>('SELECT 1 FROM memberships')).rowCount);
      expect(seen).toBe(0);
    });

    it('a member of another camp cannot read this camp by passing its id', async () => {
      const seen = await asUser(outsider, otherCamp, async db => ({
        foreign: (await db.query<Row>('SELECT 1 FROM memberships WHERE org_id = $1', [camp])).rowCount,
      }));
      expect(seen.foreign).toBe(0);
    });

    // Contract step (packages/db/migrations/0034): the policies require a signed-in member only after v0.2.3 is retired.

    it.skip('a user with no membership cannot write into the camp', async () => {
      await expect(
        asUser(outsider, camp, db =>
          db.query(
            `INSERT INTO memberships (org_id, person_id, plan, starts_on, ends_on) VALUES ($1, $2, 'X', '2026-07-01', '2026-07-02')`,
            [camp, person],
          ),
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });

  describe('the owner-rights functions use the signed-in user and check their role', () => {
    it('a viewer cannot archive the camp, and it stays active', async () => {
      await expect(asUser(viewer, camp, db => db.query('SELECT buxa_archive_camp($1)', [camp]))).rejects.toThrow(
        /Only the camp owner/,
      );
      expect(await archivedAt()).toBeNull();
    });

    it('an admin cannot delete the camp, and nothing is deleted', async () => {
      const name = await campName();
      await expect(
        asUser(admin, camp, db => db.query('SELECT buxa_delete_camp($1, $2)', [camp, name])),
      ).rejects.toThrow(/Only the camp owner/);
      expect(await campName()).toBe(name);
    });

    it('an owner can archive the camp, and unarchive it again', async () => {
      await asUser(owner, camp, db => db.query('SELECT buxa_archive_camp($1)', [camp]));
      expect(await archivedAt()).not.toBeNull();
      await asUser(owner, camp, db => db.query('SELECT buxa_unarchive_camp($1)', [camp]));
      expect(await archivedAt()).toBeNull();
    });

    it('a viewer cannot rename a member (admin or owner only)', async () => {
      const renamed = await asUser(
        viewer,
        camp,
        async db =>
          (await db.query<Row>('SELECT user_id FROM buxa_rename_member_v2($1, $2, $3)', [camp, target, 'Renamed']))
            .rows,
      );
      expect(renamed).toEqual([]);
      const { rows } = await pool.query<{ name: string }>('SELECT name FROM users WHERE id = $1', [target]);
      expect(rows[0].name).toBe('target');
    });

    it('an admin can rename a member of the camp', async () => {
      const rows = await asUser(
        admin,
        camp,
        async db =>
          (await db.query<Row>('SELECT user_id FROM buxa_rename_member_v2($1, $2, $3)', [camp, target, 'Renamed']))
            .rows,
      );
      expect(rows).toHaveLength(1);
      await pool.query(`UPDATE users SET name = 'target' WHERE id = $1`, [target]);
    });

    it('the list functions return only the signed-in user’s camps', async () => {
      const mine = await asUser(
        outsider,
        null,
        async db =>
          (await db.query<{ orgId: string }>('SELECT member_org_id AS "orgId" FROM buxa_memberships_of()')).rows,
      );
      expect(mine.map(r => r.orgId)).toEqual([otherCamp]);
      const nobody = await asUser(
        null,
        null,
        async db =>
          (await db.query<{ orgId: string }>('SELECT member_org_id AS "orgId" FROM buxa_memberships_of()')).rows,
      );
      expect(nobody).toEqual([]);
    });

    // Contract step (packages/db/migrations/0034): the policies require a signed-in member only after v0.2.3 is retired.

    it.skip('a function cannot be called with another user’s id, because the argument no longer exists', async () => {
      await expect(
        asUser(owner, camp, db => db.query('SELECT buxa_archive_camp($1::uuid, $2::uuid)', [camp, outsider])),
      ).rejects.toThrow(/function buxa_archive_camp\(uuid, uuid\) does not exist/);
      await expect(
        asUser(owner, camp, db => db.query('SELECT buxa_memberships_of($1::uuid)', [outsider])),
      ).rejects.toThrow(/function buxa_memberships_of\(uuid\) does not exist/);
      await expect(
        asUser(owner, camp, db =>
          db.query('SELECT buxa_delete_camp($1::uuid, $2::uuid, $3::text)', [camp, owner, 'x']),
        ),
      ).rejects.toThrow(/function buxa_delete_camp\(uuid, uuid, text\) does not exist/);
    });

    it('a refused caller leaves no audit row', async () => {
      const before = (
        await pool.query<Row>(`SELECT count(*)::int AS n FROM audit_log WHERE org_id = $1 AND action = 'org.archive'`, [
          camp,
        ])
      ).rows[0].n;
      await expect(asUser(viewer, camp, db => db.query('SELECT buxa_archive_camp($1)', [camp]))).rejects.toThrow();
      const after = (
        await pool.query<Row>(`SELECT count(*)::int AS n FROM audit_log WHERE org_id = $1 AND action = 'org.archive'`, [
          camp,
        ])
      ).rows[0].n;
      expect(after).toBe(before);
    });
  });
});
