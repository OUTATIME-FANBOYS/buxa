import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';
import type { Row } from '../types';

// Team access expiry (org_members.expires_at, migration 0043). An expired membership is no membership: is_member() returns NULL,
// the sign-in list leaves the camp out, and the expiry is set or cleared only through buxa_set_member_expiry, with the owner rule
// and an audit row per change.
const url = process.env.DATABASE_URL;

const PAST = '2020-01-01T00:00:00.000Z';
const FUTURE = '2099-01-01T00:00:00.000Z';

describe.skipIf(!url)('team access expiry (migration 0043)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = Math.random().toString(36).slice(2, 8);
  let org = '';
  let owner = '';
  let admin = '';
  let staff = '';

  /** Reads is_member() as the signed-in user, the way a row policy does. */
  const roleSeenBy = (userId: string) =>
    withOrg(pool, userId, org, async db => {
      const { rows } = await db.query<{ role: string | null }>('SELECT is_member($1) AS role', [org]);

      return rows[0].role;
    });

  const setExpiry = (actorId: string, memberId: string, expiresAt: string | null) =>
    withOrg(pool, actorId, org, db =>
      db.query('SELECT buxa_set_member_expiry($1, $2, $3)', [org, memberId, expiresAt]),
    );

  const setExpiryRow = async (memberId: string) =>
    (
      await pool.query<{ expires_at: Date | null }>(
        `SELECT expires_at FROM org_members WHERE org_id = $1 AND user_id = $2`,
        [org, memberId],
      )
    ).rows[0].expires_at;

  beforeAll(async () => {
    await migrate(pool);
    org = (
      await pool.query<{ id: string }>(`INSERT INTO orgs(name, slug) VALUES ('Expiry Camp', $1) RETURNING id`, [
        `expiry-camp-${tag}`,
      ])
    ).rows[0].id;
    const user = async (label: string) =>
      (
        await pool.query<{ id: string }>(`INSERT INTO users(email, name) VALUES ($1, 'Test') RETURNING id`, [
          `${label}-${tag}@expiry.test`,
        ])
      ).rows[0].id;
    owner = await user('owner');
    admin = await user('admin');
    staff = await user('staff');
    await pool.query<Row>(
      `INSERT INTO org_members(org_id, user_id, role) VALUES ($1,$2,'owner'), ($1,$3,'admin'), ($1,$4,'staff')`,
      [org, owner, admin, staff],
    );
  });

  afterAll(async () => {
    await pool.query<Row>('DELETE FROM orgs WHERE id = $1', [org]).catch(() => {});
    await pool.query<Row>('DELETE FROM users WHERE id = ANY($1)', [[owner, admin, staff]]).catch(() => {});
    await pool.end();
  });

  it('a member with no expiry, or a future one, keeps their role', async () => {
    expect(await roleSeenBy(staff)).toBe('staff');
    await setExpiry(owner, staff, FUTURE);
    expect(await roleSeenBy(staff)).toBe('staff');
    await setExpiry(owner, staff, null);
  });

  it('an expired member is refused by is_member, the same as a non-member', async () => {
    await setExpiry(owner, staff, PAST);
    expect(await roleSeenBy(staff)).toBeNull();
  });

  it('an expired member is left out of the sign-in camp list, and the owner is not', async () => {
    await setExpiry(owner, staff, PAST);
    const listed = await withOrg(pool, staff, null, async db => {
      const { rows } = await db.query<{ member_org_id: string }>('SELECT member_org_id FROM buxa_memberships_of()');

      return rows.map(r => r.member_org_id);
    });
    expect(listed).not.toContain(org);
    const ownerList = await withOrg(pool, owner, null, async db => {
      const { rows } = await db.query<{ member_org_id: string }>('SELECT member_org_id FROM buxa_memberships_of()');

      return rows.map(r => r.member_org_id);
    });
    expect(ownerList).toContain(org);
    await setExpiry(owner, staff, null);
  });

  it('clearing the expiry restores access', async () => {
    await setExpiry(owner, staff, PAST);
    expect(await roleSeenBy(staff)).toBeNull();
    await setExpiry(owner, staff, null);
    expect(await roleSeenBy(staff)).toBe('staff');
    expect(await setExpiryRow(staff)).toBeNull();
  });

  it('an admin can expire a staff member, but not the owner', async () => {
    await setExpiry(admin, staff, FUTURE);
    expect(await setExpiryRow(staff)).not.toBeNull();
    await setExpiry(admin, staff, null);

    await expect(setExpiry(admin, owner, PAST)).rejects.toThrow(/owner/);
    expect(await setExpiryRow(owner)).toBeNull();
    expect(await roleSeenBy(owner)).toBe('owner');
  });

  it('nobody sets their own expiry, and staff set no expiry', async () => {
    await expect(setExpiry(admin, admin, PAST)).rejects.toThrow(/your own/);
    await expect(setExpiry(staff, admin, PAST)).rejects.toThrow(/admin or the owner/);
  });

  it('an expired admin loses the right to set expiries', async () => {
    await setExpiry(owner, admin, PAST);
    await expect(setExpiry(admin, staff, FUTURE)).rejects.toThrow(/admin or the owner/);
    await setExpiry(owner, admin, null);
  });

  it('writes member.expiry_set and member.expiry_clear rows with the from and to values', async () => {
    // Only the rows this test writes: the earlier tests in this file change the same person's expiry too.
    const { rows: head } = await pool.query<{ id: string }>(
      `SELECT COALESCE(MAX(id), 0)::text AS id FROM audit_log WHERE org_id = $1`,
      [org],
    );
    await setExpiry(owner, staff, FUTURE);
    await setExpiry(owner, staff, null);
    const { rows } = await pool.query<{
      action: string;
      actor_id: string;
      entity_id: string;
      data: Record<string, unknown>;
    }>(
      `SELECT action, actor_id, entity_id, data FROM audit_log
        WHERE org_id = $1 AND id > $2 AND action LIKE 'member.expiry_%' ORDER BY id`,
      [org, head[0].id],
    );
    const ours = rows.filter(r => r.entity_id === staff);
    expect(ours.map(r => r.action)).toEqual(['member.expiry_set', 'member.expiry_clear']);
    expect(ours[0].actor_id).toBe(owner);
    expect(ours[0].data.from).toBeNull();
    // Postgres writes the instant in its own text form, so compare the instant, not the string.
    expect(Date.parse(String(ours[0].data.to))).toBe(Date.parse(FUTURE));
    expect(ours[1].data.to).toBeNull();
  });

  it('does not change an expiry that is already the same, and writes no audit row for it', async () => {
    await setExpiry(owner, staff, null);
    const before = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM audit_log WHERE org_id = $1 AND action LIKE 'member.expiry_%'`,
      [org],
    );
    await setExpiry(owner, staff, null);
    const after = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM audit_log WHERE org_id = $1 AND action LIKE 'member.expiry_%'`,
      [org],
    );
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });
});
