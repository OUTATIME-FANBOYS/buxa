import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';

const url = process.env.DATABASE_URL;

// Seat holds (migration 0025) follow the same tenant rules as classes, sessions and enrolments: org_id on every row, forced
// row-level security, and no way for one camp to read or write another camp's holds. These need a real Postgres (DATABASE_URL).
describe.skipIf(!url)('seat holds: isolation and constraints', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(6).toString('hex');
  let orgA = '';
  let orgB = '';
  let sessionA = '';
  let householdA = '';
  let holdA = '';

  beforeAll(async () => {
    await migrate(pool);
    orgA = (
      await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Hold camp A', $1) RETURNING id`, [
        `hold-a-${tag}`,
      ])
    ).rows[0].id;
    orgB = (
      await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Hold camp B', $1) RETURNING id`, [
        `hold-b-${tag}`,
      ])
    ).rows[0].id;

    // One class, a session (the class row) and a household in camp A, then one hold on it.
    await withOrg(pool, orgA, async db => {
      const classId = (
        await db.query<{ id: string }>(
          `INSERT INTO classes (org_id, name, age_min, age_max, default_capacity) VALUES ($1, 'Holds', 8, 12, 10) RETURNING id`,
          [orgA],
        )
      ).rows[0].id;
      sessionA = (
        await db.query<{ id: string }>(
          `INSERT INTO sessions (org_id, class_id, starts_at, ends_at, location, capacity, ratio_campers, ratio_instructors)
           VALUES ($1, $2, '2027-07-05T09:00:00Z', '2027-07-05T12:00:00Z', 'Hall 1', 4, 8, 1) RETURNING id`,
          [orgA, classId],
        )
      ).rows[0].id;
      householdA = (
        await db.query<{ id: string }>(
          `INSERT INTO households (org_id, name) VALUES ($1, 'Camp A family') RETURNING id`,
          [orgA],
        )
      ).rows[0].id;
      holdA = (
        await db.query<{ id: string }>(
          `INSERT INTO seat_holds (org_id, session_id, household_id, expires_at) VALUES ($1, $2, $3, now() + interval '15 minutes') RETURNING id`,
          [orgA, sessionA, householdA],
        )
      ).rows[0].id;
    });
  });
  afterAll(async () => {
    await pool.query('DELETE FROM orgs WHERE id = ANY($1::uuid[])', [[orgA, orgB]]).catch(() => undefined);
    await pool.end();
  });

  it('row-level security is enabled and forced on seat_holds, with a tenant policy', async () => {
    const { rows } = await pool.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean; policies: number }>(
      `SELECT c.relrowsecurity, c.relforcerowsecurity,
              (SELECT count(*)::int FROM pg_policies p WHERE p.tablename = 'seat_holds' AND p.policyname = 'seat_holds_tenant') AS policies
         FROM pg_class c WHERE c.relname = 'seat_holds'`,
    );
    expect(rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true, policies: 1 });
  });

  it("camp B cannot see camp A's holds", async () => {
    const seenByB = await withOrg(pool, orgB, async db =>
      (await db.query<{ id: string }>(`SELECT id FROM seat_holds`)).rows.map(r => r.id),
    );
    expect(seenByB).toEqual([]);

    const seenByA = await withOrg(pool, orgA, async db =>
      (await db.query<{ id: string }>(`SELECT id FROM seat_holds`)).rows.map(r => r.id),
    );
    expect(seenByA).toEqual([holdA]);
  });

  it("camp B cannot release camp A's hold, and nothing is changed", async () => {
    const changed = await withOrg(
      pool,
      orgB,
      async db =>
        (
          await db.query(`UPDATE seat_holds SET released_at = now(), release_reason = 'cancelled' WHERE id = $1`, [
            holdA,
          ])
        ).rowCount,
    );
    expect(changed).toBe(0);
    const { rows } = await pool.query<{ released_at: Date | null }>(
      `SELECT released_at FROM seat_holds WHERE id = $1`,
      [holdA],
    );
    expect(rows[0].released_at).toBeNull();
  });

  it('camp B cannot write a hold into camp A', async () => {
    await expect(
      withOrg(pool, orgB, async db =>
        db.query(
          `INSERT INTO seat_holds (org_id, session_id, household_id, expires_at) VALUES ($1, $2, $3, now() + interval '15 minutes')`,
          [orgA, sessionA, householdA],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('a hold is released, never deleted: the request role has no DELETE grant', async () => {
    const { rows } = await pool.query<{ can_delete: boolean }>(
      `SELECT has_table_privilege('buxa_app', 'seat_holds', 'DELETE') AS can_delete`,
    );
    expect(rows[0].can_delete).toBe(false);
  });

  it('a released hold must say why: a release time and a reason go together', async () => {
    await expect(
      withOrg(pool, orgA, async db =>
        db.query(
          `INSERT INTO seat_holds (org_id, session_id, household_id, expires_at, released_at) VALUES ($1, $2, $3, now(), now())`,
          [orgA, sessionA, householdA],
        ),
      ),
    ).rejects.toThrow(/seat_holds_release_reason_check|check constraint/);
  });
});
