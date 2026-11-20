import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';
import { memberOf } from './support';
import type { Row } from '../types';

// Phase 3 teacher role: a teacher is a camp member with role 'teacher', assigned to classes. These need a real Postgres.
const url = process.env.DATABASE_URL;
describe.skipIf(!url)('teacher role and class assignments (row-level security)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = Math.random().toString(36).slice(2, 8);
  let campA = '';
  let campB = '';
  let teacherA = '';
  let teacherB = '';
  let adminA = '';
  let ownerB = '';
  let classA = '';
  let classB = '';

  beforeAll(async () => {
    await migrate(pool);
    const org = async (name: string) =>
      (
        await pool.query<{ id: string }>(`INSERT INTO orgs(name, slug) VALUES ($1, $2) RETURNING id`, [
          name,
          `${name.toLowerCase().replace(/\s/g, '-')}-${tag}`,
        ])
      ).rows[0].id;
    const user = async (email: string) =>
      (
        await pool.query<{ id: string }>(`INSERT INTO users(email, name) VALUES ($1, 'Test') RETURNING id`, [
          `${email}-${tag}@t.test`,
        ])
      ).rows[0].id;
    campA = await org('Camp A');
    campB = await org('Camp B');
    teacherA = await user('teacher-a');
    teacherB = await user('teacher-b');
    adminA = await user('admin-a');
    await pool.query<Row>(
      `INSERT INTO org_members(org_id, user_id, role) VALUES ($1,$2,'teacher'), ($1,$3,'admin'), ($4,$5,'teacher')`,
      [campA, teacherA, adminA, campB, teacherB],
    );
    const sessionFor = async (org: string, name: string) => {
      const parent = (
        await pool.query<{ id: string }>(
          `INSERT INTO classes (org_id, name, default_capacity) VALUES ($1, $2, 5) RETURNING id`,
          [org, name],
        )
      ).rows[0].id;

      return (
        await pool.query<{ id: string }>(
          `INSERT INTO sessions (org_id, class_id, starts_at, ends_at, location, capacity, ratio_campers, ratio_instructors)
           VALUES ($1, $2, now(), now() + interval '1 hour', 'Lake', 10, 8, 1) RETURNING id`,
          [org, parent],
        )
      ).rows[0].id;
    };
    classA = await sessionFor(campA, `A ${tag}`);
    ownerB = await memberOf(pool, campB);
    classB = await sessionFor(campB, `B ${tag}`);
  });

  afterAll(async () => {
    await pool.query<Row>('DELETE FROM orgs WHERE id = ANY($1)', [[campA, campB]]).catch(() => {});
    await pool.query<Row>('DELETE FROM users WHERE id = ANY($1)', [[teacherA, teacherB, adminA]]).catch(() => {});
    await pool.end();
  });

  it('the teacher role exists in the org_role enum', async () => {
    const r = await pool.query<{ enumlabel: string }>(
      `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'org_role'`,
    );
    expect(r.rows.map(x => x.enumlabel)).toContain('teacher');
  });

  it('a teacher in camp A cannot read or write camp B assignments', async () => {
    await withOrg(pool, ownerB, campB, db =>
      db.query(`SELECT buxa_replace_class_teachers($1, $2, $3)`, [campB, classB, [teacherB]]),
    );
    await withOrg(pool, teacherA, campA, async db => {
      expect((await db.query<Row>('SELECT session_id FROM class_teachers')).rows).toEqual([]);
      await expect(
        db.query(`INSERT INTO class_teachers (org_id, session_id, user_id) VALUES ($1, $2, $3)`, [
          campB,
          classB,
          teacherB,
        ]),
      ).rejects.toThrow();
    });
    await withOrg(pool, ownerB, campB, async db => {
      expect((await db.query<Row>('SELECT user_id FROM class_teachers')).rows.map(r => r.user_id)).toEqual([teacherB]);
    });
  });

  it('assigns only members with the teacher role, in the same camp', async () => {
    // Each refused call runs in its own transaction: a failed statement aborts the rest of its transaction.
    await expect(
      withOrg(pool, adminA, campA, db =>
        db.query(`SELECT buxa_replace_class_teachers($1, $2, $3)`, [campA, classA, [adminA]]),
      ),
    ).rejects.toThrow('Teacher not found');
    await expect(
      withOrg(pool, adminA, campA, db =>
        db.query(`SELECT buxa_replace_class_teachers($1, $2, $3)`, [campA, classA, [teacherB]]),
      ),
    ).rejects.toThrow('Teacher not found');
    await withOrg(pool, adminA, campA, db =>
      db.query(`SELECT buxa_replace_class_teachers($1, $2, $3)`, [campA, classA, [teacherA]]),
    );
    await withOrg(pool, adminA, campA, async db => {
      expect((await db.query<Row>('SELECT user_id FROM class_teachers')).rows.map(r => r.user_id)).toEqual([teacherA]);
    });
  });

  it('a member who stops being a teacher loses their class assignments', async () => {
    await pool.query(`UPDATE org_members SET role = 'viewer' WHERE org_id = $1 AND user_id = $2`, [campA, teacherA]);
    const r = await pool.query<Row>('SELECT 1 FROM class_teachers WHERE org_id = $1 AND user_id = $2', [
      campA,
      teacherA,
    ]);
    expect(r.rows).toEqual([]);
    await pool.query(`UPDATE org_members SET role = 'teacher' WHERE org_id = $1 AND user_id = $2`, [campA, teacherA]);
  });
});
