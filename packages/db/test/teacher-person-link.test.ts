import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';
import { memberOf } from './support';
import type { Row } from '../types';

// Phase 4 (migration 0051): a class's teachers are its instructors (session_instructors, keyed by person). A teacher's login is
// linked to its roster person (people.user_id). These need a real Postgres.
const url = process.env.DATABASE_URL;
describe.skipIf(!url)('teacher login linked to a roster person (row-level security)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = Math.random().toString(36).slice(2, 8);
  let campA = '';
  let campB = '';
  let teacherA = '';
  let teacherB = '';
  let personA = '';
  let otherPersonA = '';
  let classA = '';
  let classB = '';
  let ownerB = '';

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
    await pool.query<Row>(
      `INSERT INTO org_members(org_id, user_id, role) VALUES ($1,$2,'teacher'), ($3,$4,'teacher')`,
      [campA, teacherA, campB, teacherB],
    );
    personA = (
      await pool.query<{ id: string }>(
        `INSERT INTO people(org_id, given_name, family_name, email, user_id) VALUES ($1, 'Tina', 'Teacher', $2, $3) RETURNING id`,
        [campA, `tina-${tag}@t.test`, teacherA],
      )
    ).rows[0].id;
    otherPersonA = (
      await pool.query<{ id: string }>(
        `INSERT INTO people(org_id, given_name, family_name, email) VALUES ($1, 'Other', 'Person', $2) RETURNING id`,
        [campA, `other-${tag}@t.test`],
      )
    ).rows[0].id;
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
    classB = await sessionFor(campB, `B ${tag}`);
    await pool.query<Row>(`INSERT INTO session_instructors (org_id, session_id, person_id) VALUES ($1, $2, $3)`, [
      campA,
      classA,
      personA,
    ]);
    ownerB = await memberOf(pool, campB);
    const personB = (
      await pool.query<{ id: string }>(
        `INSERT INTO people(org_id, given_name, family_name, email, user_id) VALUES ($1, 'Bea', 'Bee', $2, $3) RETURNING id`,
        [campB, `bea-${tag}@t.test`, teacherB],
      )
    ).rows[0].id;
    await pool.query<Row>(`INSERT INTO session_instructors (org_id, session_id, person_id) VALUES ($1, $2, $3)`, [
      campB,
      classB,
      personB,
    ]);
  });

  afterAll(async () => {
    await pool.query<Row>('DELETE FROM orgs WHERE id = ANY($1)', [[campA, campB]]).catch(() => {});
    await pool.query<Row>('DELETE FROM users WHERE id = ANY($1)', [[teacherA, teacherB]]).catch(() => {});
    await pool.end();
  });

  it('class_teachers is gone: the instructors are the one source', async () => {
    const table = await pool.query<{ reg: string | null }>(`SELECT to_regclass('class_teachers')::text AS reg`);
    expect(table.rows[0].reg).toBeNull();
  });

  it('a teacher reads the instructor rows of its own camp only', async () => {
    await withOrg(pool, teacherA, campA, async db => {
      const rows = await db.query<{ session_id: string }>('SELECT session_id FROM session_instructors');
      expect(rows.rows.map(r => r.session_id)).toEqual([classA]);
    });
  });

  it('a teacher linked in camp A cannot see camp B instructors', async () => {
    await withOrg(pool, teacherA, campB, async db => {
      const rows = await db.query<Row>('SELECT 1 FROM session_instructors');
      expect(rows.rows).toEqual([]);
    });
  });

  it('a login can be linked only to a person of a camp it belongs to', async () => {
    await expect(
      pool.query(`UPDATE people SET user_id = $3 WHERE org_id = $1 AND id = $2`, [campA, otherPersonA, teacherB]),
    ).rejects.toThrow();
  });

  it('one camp has one person per login', async () => {
    await expect(
      pool.query(`UPDATE people SET user_id = $3 WHERE org_id = $1 AND id = $2`, [campA, otherPersonA, teacherA]),
    ).rejects.toThrow();
  });

  it('removing a teacher from the camp clears the link, so the teacher has no person there', async () => {
    await pool.query(`DELETE FROM org_members WHERE org_id = $1 AND user_id = $2`, [campA, teacherA]);
    const link = await pool.query<{ user_id: string | null }>(`SELECT user_id FROM people WHERE id = $1`, [personA]);
    expect(link.rows).toEqual([{ user_id: null }]);
    await pool.query(`INSERT INTO org_members(org_id, user_id, role) VALUES ($1, $2, 'teacher')`, [campA, teacherA]);
    await pool.query(`UPDATE people SET user_id = $2 WHERE id = $1`, [personA, teacherA]);
  });

  it('a camp owner reads its own camp B link', async () => {
    await withOrg(pool, ownerB, campB, async db => {
      const rows = await db.query<{ user_id: string }>('SELECT user_id FROM people WHERE user_id IS NOT NULL');
      expect(rows.rows.map(r => r.user_id)).toEqual([teacherB]);
    });
  });
});
