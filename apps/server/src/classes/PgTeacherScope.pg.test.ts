import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { PgClassRepository } from './PgClassRepository';
import { teacherScopeOf } from './teacherScope';

// The assigned-classes scope against real Postgres, as the request role. A teacher sees a class when its linked person (people.user_id)
// is one of the class's instructors (session_instructors, migration 0051). Camp A: the teacher's linked person instructs sessionA.
const url = process.env.DATABASE_URL;
describe.skipIf(!url)('teacher scope on Postgres (row-level security)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const repo = new PgClassRepository(pool);
  const tag = Math.random().toString(36).slice(2, 8);
  let orgA = '';
  let orgB = '';
  let teacherA = '';
  let teacherB = '';
  let sessionA = '';
  let personA = '';

  beforeAll(async () => {
    await migrate(pool);
    const org = async (name: string) =>
      (
        await pool.query<{ id: string }>(`INSERT INTO orgs(name, slug) VALUES ($1, $2) RETURNING id`, [
          name,
          `${name.toLowerCase().replace(/\s/g, '-')}-${tag}`,
        ])
      ).rows[0].id;
    const user = async (label: string) =>
      (
        await pool.query<{ id: string }>(`INSERT INTO users(email, name) VALUES ($1, 'Test') RETURNING id`, [
          `${label}-${tag}@t.test`,
        ])
      ).rows[0].id;
    orgA = await org('Camp A');
    orgB = await org('Camp B');
    teacherA = await user('teacher-a');
    teacherB = await user('teacher-b');
    await pool.query(`INSERT INTO org_members(org_id, user_id, role) VALUES ($1,$2,'viewer'), ($3,$4,'viewer')`, [
      orgA,
      teacherA,
      orgB,
      teacherB,
    ]);
    const parentA = (
      await pool.query<{ id: string }>(
        `INSERT INTO classes (org_id, name, default_capacity) VALUES ($1, $2, 5) RETURNING id`,
        [orgA, `A ${tag}`],
      )
    ).rows[0].id;
    sessionA = (
      await pool.query<{ id: string }>(
        `INSERT INTO sessions (org_id, class_id, starts_at, ends_at, location, capacity, ratio_campers, ratio_instructors)
         VALUES ($1, $2, now(), now() + interval '1 hour', 'Lake', 10, 8, 1) RETURNING id`,
        [orgA, parentA],
      )
    ).rows[0].id;
    const teacherPersonA = (
      await pool.query<{ id: string }>(
        `INSERT INTO people (org_id, given_name, family_name, user_id) VALUES ($1, 'Tess', 'Teacher', $2) RETURNING id`,
        [orgA, teacherA],
      )
    ).rows[0].id;
    // The instructor person role (migration 0069): the teaching view reads the person's classes through it.
    await pool.query(`INSERT INTO person_roles (org_id, person_id, role) VALUES ($1, $2, 'instructor')`, [
      orgA,
      teacherPersonA,
    ]);
    personA = (
      await pool.query<{ id: string }>(
        `INSERT INTO people (org_id, given_name, family_name) VALUES ($1, 'Kim', 'Camp') RETURNING id`,
        [orgA],
      )
    ).rows[0].id;
    await pool.query(`INSERT INTO session_instructors (org_id, session_id, person_id) VALUES ($1, $2, $3)`, [
      orgA,
      sessionA,
      teacherPersonA,
    ]);
    await pool.query(`INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled')`, [
      orgA,
      sessionA,
      personA,
    ]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM orgs WHERE id = ANY($1)', [[orgA, orgB]]).catch(() => {});
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [[teacherA, teacherB]]).catch(() => {});
    await pool.end();
  });

  it('a teacher sees the class its linked person instructs, and the campers in it', async () => {
    const scope = await teacherScopeOf(repo, { userId: teacherA, orgId: orgA, role: 'viewer', instructor: true });
    expect([...(scope?.classIds ?? [])]).toEqual([sessionA]);
    expect([...(scope?.camperIds ?? [])]).toEqual([personA]);
  });

  it('a teacher with no linked person sees no classes', async () => {
    expect(await repo.assignedClassIds(teacherB, orgB, teacherB)).toEqual([]);
    const scope = await teacherScopeOf(repo, { userId: teacherB, orgId: orgB, role: 'viewer', instructor: true });
    expect([...(scope?.classIds ?? [])]).toEqual([]);
  });

  it("a teacher in camp B has no classes in camp A, and camp A's classes are invisible to it", async () => {
    expect(await repo.assignedClassIds(teacherA, orgB, teacherA)).toEqual([]);
    expect(await repo.assignedClassIds(teacherB, orgA, teacherB)).toEqual([]);
    expect(await repo.camperIdsIn(teacherA, orgB, [sessionA])).toEqual([]);
    expect(await repo.getClass(teacherA, orgB, sessionA)).toBeNull();
  });
});
