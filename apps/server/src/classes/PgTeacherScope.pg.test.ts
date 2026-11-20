import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { PgClassRepository } from './PgClassRepository';
import { TeacherNotFoundError } from './errors';
import { teacherScopeOf } from './teacherScope';

// The assigned-classes scope against real Postgres, as the request role: a teacher in camp A sees only its camp A classes.
const url = process.env.DATABASE_URL;
describe.skipIf(!url)('teacher scope on Postgres (row-level security)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const repo = new PgClassRepository(pool);
  const tag = Math.random().toString(36).slice(2, 8);
  let orgA = '';
  let orgB = '';
  let adminA = '';
  let teacherA = '';
  let teacherB = '';
  let sessionA = '';
  let parentA = '';
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
    adminA = await user('admin-a');
    teacherA = await user('teacher-a');
    teacherB = await user('teacher-b');
    await pool.query(
      `INSERT INTO org_members(org_id, user_id, role) VALUES ($1,$2,'admin'), ($1,$3,'teacher'), ($4,$5,'teacher')`,
      [orgA, adminA, teacherA, orgB, teacherB],
    );
    parentA = (
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
    personA = (
      await pool.query<{ id: string }>(
        `INSERT INTO people (org_id, given_name, family_name) VALUES ($1, 'Kim', 'Camp') RETURNING id`,
        [orgA],
      )
    ).rows[0].id;
    await pool.query(`INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled')`, [
      orgA,
      sessionA,
      personA,
    ]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM orgs WHERE id = ANY($1)', [[orgA, orgB]]).catch(() => {});
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [[adminA, teacherA, teacherB]]).catch(() => {});
    await pool.end();
  });

  it('a teacher is assigned its class by the camp admin, and sees its campers', async () => {
    await repo.replaceTeachers({ userId: adminA, orgId: orgA, role: 'admin' }, sessionA, [teacherA]);
    const scope = await teacherScopeOf(repo, { userId: teacherA, orgId: orgA, role: 'teacher' });
    expect([...(scope?.classIds ?? [])]).toEqual([sessionA]);
    expect([...(scope?.camperIds ?? [])]).toEqual([personA]);
  });

  it("a teacher in camp B has no classes in camp A, and camp A's classes are invisible to it", async () => {
    expect(await repo.assignedClassIds(teacherA, orgB, teacherA)).toEqual([]);
    expect(await repo.assignedClassIds(teacherB, orgA, teacherB)).toEqual([]);
    expect(await repo.camperIdsIn(teacherA, orgB, [sessionA])).toEqual([]);
    expect(await repo.getClass(teacherA, orgB, sessionA)).toBeNull();
  });

  it('refuses to assign a user who is not a teacher in this camp, or a class from another camp', async () => {
    await expect(
      repo.replaceTeachers({ userId: adminA, orgId: orgA, role: 'admin' }, sessionA, [teacherB]),
    ).rejects.toBeInstanceOf(TeacherNotFoundError);
    // adminA is not a member of camp B, so the database refuses before it looks for the class.
    await expect(
      repo.replaceTeachers({ userId: adminA, orgId: orgB, role: 'admin' }, sessionA, [teacherB]),
    ).rejects.toThrow(/Not allowed to manage classes/);
  });

  it('lists the class teachers for the session page, only inside the camp that owns them', async () => {
    await repo.replaceTeachers({ userId: adminA, orgId: orgA, role: 'admin' }, sessionA, [teacherA]);

    const own = await repo.teacherAssignments(adminA, orgA, parentA);
    expect(own).toEqual([{ classId: sessionA, userId: teacherA }]);

    expect(await repo.teacherAssignments(teacherB, orgB, parentA)).toEqual([]);
  });
});
