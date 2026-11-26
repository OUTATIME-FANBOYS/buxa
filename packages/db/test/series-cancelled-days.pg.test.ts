import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../src';

// Migration 0064: a cancelled day (a row of sessions with status 'cancelled') is left out of the public class list, the teacher's
// calendar feed and the camp calendar feed. Check-in is not covered by a day filter: check_ins point at the session (a row of
// classes), not at a day, so the check-in list has no day rows to hide. These need a real Postgres (DATABASE_URL).
const url = process.env.DATABASE_URL;

describe.skipIf(!url)('cancelled days are left out of the class lists and feeds (migration 0064)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(6).toString('hex');
  const slug = `cancel-camp-${tag}`;
  let org = '';
  let sessionId = '';
  let days: string[] = [];
  let cancelledDay = '';
  let teacherToken = Buffer.alloc(0);
  let campToken = Buffer.alloc(0);

  const publicDayIds = async (): Promise<string[]> => {
    const { rows } = await pool.query<{ starts_at: Date }>('SELECT starts_at FROM buxa_public_classes_v2($1, $2, $3)', [
      slug,
      sessionId,
      new Date('2027-01-01'),
    ]);

    return rows.map(r => r.starts_at.toISOString());
  };

  const feedIds = async (fn: 'buxa_teacher_calendar_feed_classes' | 'buxa_calendar_feed_classes', hash: Buffer) => {
    const { rows } = await pool.query<{ id: string }>(`SELECT id FROM ${fn}($1)`, [hash]);

    return rows.map(r => r.id);
  };

  beforeAll(async () => {
    await migrate(pool);
    org = (
      await pool.query<{ id: string }>(
        `INSERT INTO orgs (name, slug, timezone) VALUES ('Cancel camp', $1, 'Australia/Sydney') RETURNING id`,
        [slug],
      )
    ).rows[0].id;
    sessionId = (
      await pool.query<{ id: string }>(
        `INSERT INTO classes (org_id, name, is_public, status) VALUES ($1, $2, true, 'live') RETURNING id`,
        [org, `Summer ${tag}`],
      )
    ).rows[0].id;

    // Three days, one series: the first insert makes the series (migration 0060), the others join it.
    const day = (n: number) => [`2027-07-0${n}T09:00:00+10:00`, `2027-07-0${n}T12:00:00+10:00`];
    const first = await pool.query<{ id: string; series_id: string }>(
      `INSERT INTO sessions (org_id, class_id, name, age_min, age_max, starts_at, ends_at, location, capacity)
       VALUES ($1, $2, 'Art', 8, 12, $3, $4, 'Studio', 10) RETURNING id, series_id`,
      [org, sessionId, ...day(5)],
    );
    const seriesId = first.rows[0].series_id;
    days = [first.rows[0].id];
    for (const n of [6, 7]) {
      const next = await pool.query<{ id: string }>(
        `INSERT INTO sessions (org_id, class_id, series_id, name, age_min, age_max, starts_at, ends_at, location, capacity)
         VALUES ($1, $2, $3, 'Art', 8, 12, $4, $5, 'Studio', 10) RETURNING id`,
        [org, sessionId, seriesId, ...day(n)],
      );
      days.push(next.rows[0].id);
    }
    cancelledDay = days[1];

    // A teacher on every day, linked to a person whose user is a teacher of the camp.
    const user = (
      await pool.query<{ id: string }>(`INSERT INTO users (email, name) VALUES ($1, 'Teacher') RETURNING id`, [
        `teacher-${tag}@example.test`,
      ])
    ).rows[0].id;
    // A teacher is a viewer whose person holds the instructor role (migration 0069).
    await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'viewer')`, [org, user]);
    const person = (
      await pool.query<{ id: string }>(
        `INSERT INTO people (org_id, given_name, family_name, user_id, date_of_birth, phone) VALUES ($1, 'Tess', 'Teacher', $2, '1985-06-15', '+1 555 0100') RETURNING id`,
        [org, user],
      )
    ).rows[0].id;
    await pool.query(`INSERT INTO person_roles (org_id, person_id, role) VALUES ($1, $2, 'instructor')`, [org, person]);
    for (const id of days) {
      await pool.query(`INSERT INTO session_instructors (org_id, session_id, person_id) VALUES ($1, $2, $3)`, [
        org,
        id,
        person,
      ]);
    }

    teacherToken = randomBytes(32);
    campToken = randomBytes(32);
    await pool.query(`INSERT INTO member_calendar_tokens (org_id, user_id, token_hash) VALUES ($1, $2, $3)`, [
      org,
      user,
      teacherToken,
    ]);
    await pool.query(`INSERT INTO camp_calendar_tokens (org_id, token_hash) VALUES ($1, $2)`, [org, campToken]);

    await pool.query(
      `UPDATE sessions SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'Rain' WHERE id = $1`,
      [cancelledDay],
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM orgs WHERE id = $1', [org]).catch(() => undefined);
    await pool.end();
  });

  it('the public class list leaves out the cancelled day and keeps the other two', async () => {
    const starts = await publicDayIds();
    expect(starts).toHaveLength(2);
    expect(starts).not.toContain(new Date('2027-07-06T09:00:00+10:00').toISOString());
    expect(starts).toContain(new Date('2027-07-05T09:00:00+10:00').toISOString());
    expect(starts).toContain(new Date('2027-07-07T09:00:00+10:00').toISOString());
  });

  it('the teacher calendar feed leaves out the cancelled day and keeps the other two', async () => {
    const ids = await feedIds('buxa_teacher_calendar_feed_classes', teacherToken);
    expect(ids.sort()).toEqual([days[0], days[2]].sort());
  });

  it('the camp calendar feed leaves out the cancelled day and keeps the other two', async () => {
    const ids = await feedIds('buxa_calendar_feed_classes', campToken);
    expect(ids.sort()).toEqual([days[0], days[2]].sort());
  });

  it('the check-in list reads sessions, not days: check_ins reference the session row (classes), so no day row is in it', async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT ccu.table_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'check_ins' AND tc.constraint_name = 'check_ins_session_fk'`,
    );
    expect(rows.map(r => r.table_name)).toContain('classes');
    expect(rows.map(r => r.table_name)).not.toContain('sessions');
  });
});
