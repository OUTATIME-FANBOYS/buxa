import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import type { Actor } from '@buxa/domain';
import { createClassFixture, makeSession, sessionInput, type ClassFixture } from '../classes/__tests__/pgClassFixture';
import { PgCalendarRepository } from './PgCalendarRepository';
import { hashCalendarToken } from './calendarToken';

const url = process.env.DATABASE_URL;

// A teacher's own calendar link (migration 0033): it must show only the classes assigned to that teacher, in that camp.
describe.skipIf(!url)('teacher calendar feed on Postgres', () => {
  const pool = new pg.Pool({ connectionString: url });
  beforeAll(async () => {
    await migrate(pool);
  });
  afterAll(async () => {
    await pool.end();
  });

  let fx: ClassFixture;
  let repo: PgCalendarRepository;
  let teacherIds: string[] = [];

  const addTeacher = async (orgId: string, label: string): Promise<Actor> => {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, 'Teacher') RETURNING id`,
      [`${label}-${randomBytes(4).toString('hex')}@t.test`],
    );
    const userId = rows[0].id;
    teacherIds.push(userId);
    await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'viewer')`, [orgId, userId]);

    return { userId, orgId, role: 'viewer', instructor: true };
  };

  /**
   * Makes the teacher's roster person (linked to its login, migration 0051) an instructor of the class. A teacher's feed holds the
   * classes whose instructors include its linked person.
   */
  const teach = async (orgId: string, userId: string, classId: string): Promise<void> => {
    const linked = await pool.query<{ id: string }>(`SELECT id FROM people WHERE org_id = $1 AND user_id = $2`, [
      orgId,
      userId,
    ]);
    const personId =
      linked.rows[0]?.id ??
      (
        await pool.query<{ id: string }>(
          `INSERT INTO people (org_id, given_name, family_name, user_id, date_of_birth, phone) VALUES ($1, 'Tess', 'Teacher', $2, '1985-06-15', '+1 555 0100') RETURNING id`,
          [orgId, userId],
        )
      ).rows[0].id;
    await pool.query(
      `INSERT INTO person_roles (org_id, person_id, role) VALUES ($1, $2, 'instructor') ON CONFLICT DO NOTHING`,
      [orgId, personId],
    );
    await pool.query(
      `INSERT INTO session_instructors (org_id, session_id, person_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [orgId, classId, personId],
    );
  };

  /** Makes a class in the camp (a sessions row, with its own name and hours) and returns its id. */
  const makeClass = async (actor: Actor, name: string, fromHour: number): Promise<string> => {
    const session = await makeSession(fx.repo, actor);
    const created = await fx.repo.addClass(actor, session.id, sessionInput(fromHour, fromHour + 1, { name }));

    return created.id;
  };

  const tokenHash = (): Buffer => hashCalendarToken(randomBytes(32).toString('base64url'));

  const names = async (hash: Buffer): Promise<string[]> =>
    (await repo.listTeacherFeedClasses(hash)).map(c => c.className);

  // Camp A: Robotics (9:00) and Painting (11:00) go to teacher A; Painting also goes to teacher A2, with Pottery (13:00).
  // Camp A's teacher A3 has no classes. Camp B: Kayaking, taught by teacher B.
  let teacherA: Actor;
  let teacherA2: Actor;
  let teacherA3: Actor;
  let teacherB: Actor;
  let hashA: Buffer;
  let hashA2: Buffer;
  let hashA3: Buffer;
  let hashB: Buffer;

  beforeEach(async () => {
    fx = await createClassFixture(pool);
    repo = new PgCalendarRepository(pool);
    teacherA = await addTeacher(fx.orgA, 'teacher-a');
    teacherA2 = await addTeacher(fx.orgA, 'teacher-a2');
    teacherA3 = await addTeacher(fx.orgA, 'teacher-a3');
    teacherB = await addTeacher(fx.orgB, 'teacher-b');

    const robotics = await makeClass(fx.actor, 'Robotics', 9);
    const painting = await makeClass(fx.actor, 'Painting', 11);
    const pottery = await makeClass(fx.actor, 'Pottery', 13);
    const kayaking = await makeClass(fx.otherActor, 'Kayaking', 9);
    await teach(fx.orgA, teacherA.userId, robotics);
    await teach(fx.orgA, teacherA.userId, painting);
    await teach(fx.orgA, teacherA2.userId, painting);
    await teach(fx.orgA, teacherA2.userId, pottery);
    await teach(fx.orgB, teacherB.userId, kayaking);

    hashA = tokenHash();
    hashA2 = tokenHash();
    hashA3 = tokenHash();
    hashB = tokenHash();
    await repo.saveMemberTokenHash(teacherA, hashA);
    await repo.saveMemberTokenHash(teacherA2, hashA2);
    await repo.saveMemberTokenHash(teacherA3, hashA3);
    await repo.saveMemberTokenHash(teacherB, hashB);
  });

  afterEach(async () => {
    await fx.close();
    await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [teacherIds]).catch(() => undefined);
    teacherIds = [];
  });

  it("a teacher's token returns only the classes assigned to that teacher, in order", async () => {
    expect(await names(hashA)).toEqual(['Robotics', 'Painting']);
  });

  it('another teacher in the same camp sees only their own classes, not the ones they do not teach', async () => {
    const mine = await names(hashA2);

    expect(mine).toEqual(['Painting', 'Pottery']);
    expect(mine).not.toContain('Robotics');
  });

  it('an unassigned teacher sees nothing', async () => {
    expect(await names(hashA3)).toEqual([]);
  });

  it("a teacher of another camp sees none of camp A's classes", async () => {
    expect(await names(hashB)).toEqual(['Kayaking']);
  });

  it('an unknown token resolves to no teacher, and a camp token is not a teacher token', async () => {
    expect(await repo.findTeacherByTokenHash(tokenHash())).toBeNull();
    expect(await repo.findTeacherByTokenHash(hashA)).toMatchObject({ orgId: fx.orgA, archived: false });
    expect(await repo.listTeacherFeedClasses(tokenHash())).toEqual([]);
  });

  it('a person who stops being a teacher loses the link at once', async () => {
    // A teacher is a viewer whose person holds the instructor role (migration 0069), so stopping is losing that role.
    await pool.query(
      `DELETE FROM person_roles WHERE org_id = $1 AND role = 'instructor'
         AND person_id IN (SELECT id FROM people WHERE org_id = $1 AND user_id = $2)`,
      [fx.orgA, teacherA.userId],
    );

    expect(await repo.findTeacherByTokenHash(hashA)).toBeNull();
    expect(await names(hashA)).toEqual([]);
  });

  it('an archived camp resolves as archived and feeds nothing', async () => {
    await pool.query('UPDATE orgs SET archived_at = now() WHERE id = $1', [fx.orgA]);
    try {
      expect(await repo.findTeacherByTokenHash(hashA)).toMatchObject({ orgId: fx.orgA, archived: true });
      expect(await names(hashA)).toEqual([]);
    } finally {
      await pool.query('UPDATE orgs SET archived_at = NULL WHERE id = $1', [fx.orgA]);
    }
  });

  it('rotating replaces the teacher link: the old hash no longer resolves', async () => {
    const replacement = tokenHash();
    await repo.saveMemberTokenHash(teacherA, replacement);

    expect(await repo.findTeacherByTokenHash(hashA)).toBeNull();
    expect(await names(hashA)).toEqual([]);
    expect(await names(replacement)).toEqual(['Robotics', 'Painting']);
  });

  it('writes the audit entry in the same transaction and never the token or its hash', async () => {
    const hash = tokenHash();
    await repo.saveMemberTokenHash(teacherA, hash);

    const rows = await pool.query<{ action: string; data: string; entity_id: string }>(
      `SELECT action, data::text AS data, entity_id FROM audit_log WHERE org_id = $1 AND action = 'calendar.rotate_self' AND actor_id = $2 ORDER BY at DESC LIMIT 1`,
      [fx.orgA, teacherA.userId],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].entity_id).toBe(teacherA.userId);
    expect(rows.rows[0].data).not.toContain(hash.toString('hex'));
  });

  it('a teacher cannot read or write another teacher’s link, even in the same camp', async () => {
    await withOrg(pool, teacherA.userId, fx.orgA, async db => {
      const own = await db.query<{ user_id: string }>('SELECT user_id FROM member_calendar_tokens');
      expect(own.rows.map(r => r.user_id)).toEqual([teacherA.userId]);
    });

    await expect(
      withOrg(pool, teacherA.userId, fx.orgA, db =>
        db.query(`INSERT INTO member_calendar_tokens (org_id, user_id, token_hash) VALUES ($1, $2, $3)`, [
          fx.orgA,
          teacherA2.userId,
          tokenHash(),
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      withOrg(pool, teacherA.userId, fx.orgA, db =>
        db.query(`UPDATE member_calendar_tokens SET token_hash = $1 WHERE user_id = $2`, [
          tokenHash(),
          teacherA2.userId,
        ]),
      ),
    ).resolves.toMatchObject({ rowCount: 0 });
    expect(await names(hashA2)).toEqual(['Painting', 'Pottery']);
  });
});
