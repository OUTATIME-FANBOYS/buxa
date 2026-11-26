import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate, poolConfigFor, withOrg } from '../src';
import { memberOf } from './support';

// Migration 0052: a session (a row of `classes`) can be archived; a session with classes can be deleted with them by an admin or the
// owner; session names are unique in a camp, ignoring case and spaces. These need a real Postgres (DATABASE_URL).
const url = process.env.DATABASE_URL;
const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const SESSION_NAME_KEY = 'classes_org_name_normal_key';

describe.skipIf(!url)('sessions: archive, unique names and delete with classes (migration 0052)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(6).toString('hex');
  let org = '';
  let otherOrg = '';
  let owner = '';
  let admin = '';
  let staff = '';
  let viewer = '';

  const newSession = async (orgId: string, name: string): Promise<string> =>
    (await pool.query<{ id: string }>(`INSERT INTO classes (org_id, name) VALUES ($1, $2) RETURNING id`, [orgId, name]))
      .rows[0].id;

  const addClass = async (orgId: string, sessionId: string, label: string): Promise<string> =>
    (
      await pool.query<{ id: string }>(
        `INSERT INTO sessions (org_id, class_id, name, age_min, age_max, starts_at, ends_at, location, capacity)
         VALUES ($1, $2, $3, 8, 12, '2027-07-05T09:00:00+10:00', '2027-07-05T12:00:00+10:00', 'Lab ' || gen_random_uuid(), 12)
         RETURNING id`,
        [orgId, sessionId, label],
      )
    ).rows[0].id;

  const count = async (sql: string, params: unknown[]): Promise<number> =>
    (await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${sql}`, params)).rows[0].n;

  /** Deletes a session with its classes through the app's function, as a signed-in member. */
  const deleteWithClassesAs = (userId: string, orgId: string, sessionId: string) =>
    withOrg(pool, userId, orgId, db =>
      db.query<{ deleted_class_id: string; deleted_class_name: string }>(
        'SELECT * FROM buxa_delete_session_with_classes_v1($1, $2)',
        [orgId, sessionId],
      ),
    );

  beforeAll(async () => {
    await migrate(pool);
    const tagged = (label: string) => `${label}-${tag}`;
    org = (
      await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Archive camp', $1) RETURNING id`, [
        tagged('archive-camp'),
      ])
    ).rows[0].id;
    otherOrg = (
      await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Other camp', $1) RETURNING id`, [
        tagged('other-camp'),
      ])
    ).rows[0].id;
    owner = await memberOf(pool, org, 'owner');
    admin = await memberOf(pool, org, 'admin');
    staff = await memberOf(pool, org, 'staff');
    viewer = await memberOf(pool, org, 'viewer');
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('session names', () => {
    it('refuses a second session whose name matches ignoring case and spaces, in the same camp', async () => {
      await newSession(org, `Summer 2027 ${tag}`);
      await expect(newSession(org, `  summer   2027 ${tag.toUpperCase()}`)).rejects.toMatchObject({
        code: '23505',
        constraint: SESSION_NAME_KEY,
      });
    });

    it('allows the same name in another camp', async () => {
      const name = `Art ${tag}`;
      await newSession(org, name);
      await expect(newSession(otherOrg, name)).resolves.toEqual(expect.any(String));
    });
  });

  describe('delete with classes', () => {
    it('lets an admin delete the classes and the session, and returns the classes it removed', async () => {
      const sessionId = await newSession(org, `Delete both ${tag}`);
      const first = await addClass(org, sessionId, 'Robotics');
      const second = await addClass(org, sessionId, 'Painting');

      const result = await deleteWithClassesAs(admin, org, sessionId);

      expect(result.rows.map(r => r.deleted_class_id).sort()).toEqual([first, second].sort());
      expect(await count('classes WHERE id = $1', [sessionId])).toBe(0);
      expect(await count('sessions WHERE class_id = $1', [sessionId])).toBe(0);
    });

    it('lets the owner delete too', async () => {
      const sessionId = await newSession(org, `Owner delete ${tag}`);
      await addClass(org, sessionId, 'Robotics');
      await deleteWithClassesAs(owner, org, sessionId);
      expect(await count('classes WHERE id = $1', [sessionId])).toBe(0);
    });

    it('refuses staff and a viewer, and deletes nothing', async () => {
      const sessionId = await newSession(org, `Staff refused ${tag}`);
      await addClass(org, sessionId, 'Robotics');
      await expect(deleteWithClassesAs(staff, org, sessionId)).rejects.toMatchObject({ code: '42501' });
      await expect(deleteWithClassesAs(viewer, org, sessionId)).rejects.toMatchObject({ code: '42501' });
      expect(await count('classes WHERE id = $1', [sessionId])).toBe(1);
      expect(await count('sessions WHERE class_id = $1', [sessionId])).toBe(1);
    });

    it('refuses a session whose class has an enrolment, and keeps the enrolment', async () => {
      const sessionId = await newSession(org, `Enrolled ${tag}`);
      const classId = await addClass(org, sessionId, 'Robotics');
      const person = (
        await pool.query<{ id: string }>(
          `INSERT INTO people (org_id, given_name, family_name, date_of_birth, phone) VALUES ($1, 'Ada', 'Lovelace', '1985-06-15', '+1 555 0100') RETURNING id`,
          [org],
        )
      ).rows[0].id;
      await pool.query(
        `INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled')`,
        [org, classId, person],
      );

      await expect(deleteWithClassesAs(admin, org, sessionId)).rejects.toMatchObject({
        code: '23503',
        constraint: 'session_has_enrolments',
        message: 'This session has enrolments, archive it instead',
      });
      expect(await count('classes WHERE id = $1', [sessionId])).toBe(1);
      expect(await count('enrolments WHERE session_id = $1', [classId])).toBe(1);
    });
  });

  describe('archive', () => {
    it('hides an archived session from its public page and its public classes, and unarchive restores both', async () => {
      const slug = `public-${tag}`;
      const camp = (
        await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Public camp', $1) RETURNING id`, [
          slug,
        ])
      ).rows[0].id;
      const sessionId = await newSession(camp, `Public ${tag}`);
      await addClass(camp, sessionId, 'Robotics');
      await pool.query('UPDATE classes SET is_public = true WHERE id = $1', [sessionId]);
      const campOwner = await memberOf(pool, camp, 'owner');
      const publicPage = () =>
        withOrg(pool, null, null, db =>
          db.query<{ session_name: string }>('SELECT session_name FROM buxa_public_session($1, $2)', [slug, sessionId]),
        );
      const publicClasses = () =>
        withOrg(pool, null, null, db =>
          db.query<{ class_name: string }>('SELECT class_name FROM buxa_public_classes($1, $2, $3)', [
            slug,
            sessionId,
            new Date('2027-01-01'),
          ]),
        );

      expect((await publicPage()).rows).toHaveLength(1);
      expect((await publicClasses()).rows).toHaveLength(1);

      await withOrg(pool, campOwner, camp, db =>
        db.query('UPDATE classes SET archived_at = now() WHERE id = $1 AND org_id = $2', [sessionId, camp]),
      );
      expect((await publicPage()).rows).toHaveLength(0);
      expect((await publicClasses()).rows).toHaveLength(0);
      // The classes are kept while the session is archived.
      expect(await count('sessions WHERE class_id = $1', [sessionId])).toBe(1);

      await withOrg(pool, campOwner, camp, db =>
        db.query('UPDATE classes SET archived_at = NULL WHERE id = $1 AND org_id = $2', [sessionId, camp]),
      );
      expect((await publicPage()).rows).toHaveLength(1);
      expect((await publicClasses()).rows).toHaveLength(1);
    });
  });
});

describe.skipIf(!url)('migration 0052 over existing duplicate names', () => {
  const tag = randomBytes(4).toString('hex');
  const dbName = `buxa_0052_${tag}`;

  const replaceDatabaseName = (connUrl: string, newDb: string): string => {
    const parsed = new URL(connUrl);
    parsed.pathname = `/${newDb}`;

    return parsed.toString();
  };

  it('stops with the duplicates listed, adds no index and records no 0052 row', async () => {
    const root = new pg.Pool(poolConfigFor(url ?? ''));
    root.on('error', () => {});
    try {
      await root.query(`CREATE DATABASE "${dbName}"`);
    } catch (err) {
      console.warn(`Could not CREATE DATABASE for the 0052 duplicate test (insufficient privileges?): ${String(err)}`);
      await root.end().catch(() => {});

      return;
    }
    const temp = new pg.Pool(poolConfigFor(replaceDatabaseName(url ?? '', dbName)));
    temp.on('error', () => {});
    try {
      // Apply 0001 to 0051 as the upgrade test does, then add two sessions whose names collide once normalised.
      const client = await temp.connect();
      try {
        await client.query(
          'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now())',
        );
        const earlier = readdirSync(MIGRATIONS)
          .filter(f => f.endsWith('.sql') && f.slice(0, 4) <= '0051')
          .sort();
        for (const file of earlier) {
          await client.query('BEGIN');
          await client.query(readFileSync(join(MIGRATIONS, file), 'utf8'));
          await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
          await client.query('COMMIT');
        }
        const camp = (
          await client.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Dupes', $1) RETURNING id`, [
            `dupes-${tag}`,
          ])
        ).rows[0].id;
        await client.query(`INSERT INTO classes (org_id, name) VALUES ($1, 'Summer 2027'), ($1, '  summer   2027 ')`, [
          camp,
        ]);
      } finally {
        client.release();
      }

      await expect(migrate(temp)).rejects.toThrow(/Duplicate session names exist.*summer/is);

      const index = await temp.query(`SELECT 1 FROM pg_indexes WHERE indexname = $1`, [SESSION_NAME_KEY]);
      expect(index.rowCount).toBe(0);
      const recorded = await temp.query(`SELECT 1 FROM schema_migrations WHERE name = $1`, [
        '0052_session_archive_and_delete.sql',
      ]);
      expect(recorded.rowCount).toBe(0);
    } finally {
      await temp.end().catch(() => {});
      await root.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`).catch(() => {});
      await root.end().catch(() => {});
    }
    // Applying 49 migrations to a new database is slow under a full run, so this test has its own limit.
  }, 60_000);
});
