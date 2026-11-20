import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';
import { memberOf } from './support';

// Migration 0035: a session (a row of `classes`) that holds a class cannot be deleted, at the database. The foreign key from
// sessions cascades, so the trigger is what refuses it. These need a real Postgres (DATABASE_URL).
const url = process.env.DATABASE_URL;

describe.skipIf(!url)('session delete guard (migration 0035)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(6).toString('hex');
  let org = '';
  let owner = '';

  const newSession = async (name: string): Promise<string> =>
    (await pool.query<{ id: string }>(`INSERT INTO classes (org_id, name) VALUES ($1, $2) RETURNING id`, [org, name]))
      .rows[0].id;

  const addClass = async (sessionId: string): Promise<void> => {
    await pool.query(
      `INSERT INTO sessions (org_id, class_id, name, age_min, age_max, starts_at, ends_at, location, capacity)
       VALUES ($1, $2, 'Robotics', 8, 12, '2027-07-05T09:00:00+10:00', '2027-07-05T12:00:00+10:00', 'Lab 1', 12)`,
      [org, sessionId],
    );
  };

  /** Deletes a session through the app's function, as a signed-in member with the given role. */
  const deleteAs = (userId: string, sessionId: string) =>
    withOrg(pool, userId, org, db => db.query('SELECT buxa_delete_session_v2($1, $2)', [org, sessionId]));

  const countSessions = async (sessionId: string): Promise<number> =>
    (await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM classes WHERE id = $1`, [sessionId])).rows[0].n;

  beforeAll(async () => {
    await migrate(pool);
    org = (
      await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Delete guard', $1) RETURNING id`, [
        `delete-guard-${tag}`,
      ])
    ).rows[0].id;
    owner = await memberOf(pool, org, 'owner');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('refuses a direct delete of a session that holds a class, and keeps the class', async () => {
    const sessionId = await newSession('Direct delete');
    await addClass(sessionId);
    await expect(pool.query('DELETE FROM classes WHERE id = $1', [sessionId])).rejects.toMatchObject({
      code: '23503',
      constraint: 'classes_has_classes',
    });
    expect(await countSessions(sessionId)).toBe(1);
  });

  it('deletes an empty session through the function', async () => {
    const sessionId = await newSession('Empty');
    await deleteAs(owner, sessionId);
    expect(await countSessions(sessionId)).toBe(0);
  });

  it('refuses a session with a class through the function', async () => {
    const sessionId = await newSession('With a class');
    await addClass(sessionId);
    await expect(deleteAs(owner, sessionId)).rejects.toMatchObject({
      code: '23503',
      constraint: 'classes_has_classes',
    });
  });

  it('refuses a viewer through the function', async () => {
    const viewer = await memberOf(pool, org, 'viewer');
    const sessionId = await newSession('Viewer');
    await expect(deleteAs(viewer, sessionId)).rejects.toMatchObject({ code: '42501' });
    expect(await countSessions(sessionId)).toBe(1);
  });

  it('still deletes a whole camp, with its sessions and classes (the cascade is not refused)', async () => {
    const camp = (
      await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Cascade camp', $1) RETURNING id`, [
        `cascade-camp-${tag}`,
      ])
    ).rows[0].id;
    const sessionId = (
      await pool.query<{ id: string }>(`INSERT INTO classes (org_id, name) VALUES ($1, 'Cascade') RETURNING id`, [camp])
    ).rows[0].id;
    await pool.query(
      `INSERT INTO sessions (org_id, class_id, name, age_min, age_max, starts_at, ends_at, location, capacity)
       VALUES ($1, $2, 'Robotics', 8, 12, '2027-07-05T09:00:00+10:00', '2027-07-05T12:00:00+10:00', 'Lab 1', 12)`,
      [camp, sessionId],
    );
    await pool.query('DELETE FROM orgs WHERE id = $1', [camp]);
    expect(await countSessions(sessionId)).toBe(0);
  });
});
