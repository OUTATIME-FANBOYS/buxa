import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';
import type { Row } from '../types';

// Phase 3: per-person options (member_options, migration 0030). A teacher may hold check-in and check-out; the table is tenant
// scoped by row-level security, its writes go through buxa_set_member_option, and a teacher who stops being one loses them.
const url = process.env.DATABASE_URL;
describe.skipIf(!url)('member options (row-level security)', () => {
  const pool = new pg.Pool({ connectionString: url });
  // The function reads the signed-in user (app.user_id), so each call runs as the admin who sets the option.
  const setOption = (adminId: string, orgId: string, memberId: string) =>
    withOrg(pool, adminId, orgId, db =>
      db.query(`SELECT buxa_set_member_option($1, $2, 'teacher.check_in_out', true)`, [orgId, memberId]),
    );
  const tag = Math.random().toString(36).slice(2, 8);
  let campA = '';
  let campB = '';
  let teacherA = '';
  let staffA = '';
  let adminA = '';
  let adminB = '';
  let teacherB = '';

  beforeAll(async () => {
    await migrate(pool);
    const org = async (name: string) =>
      (
        await pool.query<{ id: string }>(`INSERT INTO orgs(name, slug) VALUES ($1, $2) RETURNING id`, [
          name,
          `${name.toLowerCase().replace(/\s/g, '-')}-opt-${tag}`,
        ])
      ).rows[0].id;
    const user = async (email: string) =>
      (
        await pool.query<{ id: string }>(`INSERT INTO users(email, name) VALUES ($1, 'Test') RETURNING id`, [
          `${email}-${tag}@t.test`,
        ])
      ).rows[0].id;
    campA = await org('Opt A');
    campB = await org('Opt B');
    teacherA = await user('teacher-a');
    staffA = await user('staff-a');
    adminA = await user('admin-a');
    adminB = await user('admin-b');
    teacherB = await user('teacher-b');
    await pool.query<Row>(
      `INSERT INTO org_members(org_id, user_id, role) VALUES ($1,$2,'viewer'), ($1,$3,'staff'), ($1,$4,'admin'), ($5,$6,'viewer'), ($5,$7,'admin')`,
      [campA, teacherA, staffA, adminA, campB, teacherB, adminB],
    );
    // The two teachers are instructors: a person linked to each login, holding the instructor role (migration 0069).
    for (const [orgId, userId] of [
      [campA, teacherA],
      [campB, teacherB],
    ]) {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO people (org_id, given_name, family_name, user_id) VALUES ($1, 'Tess', 'Teacher', $2) RETURNING id`,
        [orgId, userId],
      );
      await pool.query(`INSERT INTO person_roles (org_id, person_id, role) VALUES ($1, $2, 'instructor')`, [
        orgId,
        rows[0].id,
      ]);
    }
  });

  afterAll(async () => {
    await pool.query<Row>('DELETE FROM orgs WHERE id = ANY($1)', [[campA, campB]]).catch(() => {});
    await pool
      .query<Row>('DELETE FROM users WHERE id = ANY($1)', [[teacherA, staffA, adminA, teacherB]])
      .catch(() => {});
    await pool.end();
  });

  it('the table is forced under row-level security with a tenant policy', async () => {
    const r = await pool.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'member_options'`,
    );
    expect(r.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
    const p = await pool.query<{ policyname: string }>(
      `SELECT policyname FROM pg_policies WHERE tablename = 'member_options'`,
    );
    expect(p.rows.map(x => x.policyname)).toContain('member_options_tenant');
  });

  it('refuses an option key that is not in the known list', async () => {
    await expect(
      pool.query(
        `INSERT INTO member_options(org_id, user_id, option_key, enabled) VALUES ($1, $2, 'teacher.fly', true)`,
        [campA, teacherA],
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it('turns check-in on for a teacher of the camp, and records who set it', async () => {
    await setOption(adminA, campA, teacherA);
    const row = await pool.query<{ enabled: boolean; set_by: string }>(
      `SELECT enabled, set_by FROM member_options WHERE org_id = $1 AND user_id = $2`,
      [campA, teacherA],
    );
    expect(row.rows).toEqual([{ enabled: true, set_by: adminA }]);
  });

  it('refuses to set an option on anyone who is not a teacher of that camp', async () => {
    await expect(setOption(adminA, campA, staffA)).rejects.toThrow(/Instructor not found/);
    await expect(setOption(adminB, campB, teacherA)).rejects.toThrow(/Instructor not found/);
  });

  it('a camp sees only its own options', async () => {
    await setOption(adminB, campB, teacherB);
    const seenByA = await withOrg(pool, adminA, campA, db =>
      db.query<{ user_id: string }>('SELECT user_id FROM member_options WHERE enabled'),
    );
    expect(seenByA.rows.map(r => r.user_id)).toEqual([teacherA]);
  });

  it('options stay on the person when the access level changes; they count only in the teaching view', async () => {
    await pool.query(`UPDATE org_members SET role = 'staff' WHERE org_id = $1 AND user_id = $2`, [campA, teacherA]);
    const left = await pool.query(`SELECT 1 FROM member_options WHERE org_id = $1 AND user_id = $2`, [campA, teacherA]);
    expect(left.rowCount).toBe(1);
  });
});
