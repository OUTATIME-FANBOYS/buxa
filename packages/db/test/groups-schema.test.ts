import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';
import { memberOf } from './support';

const url = process.env.DATABASE_URL;

// Groups, rooms and assignments (migration 0047) follow the camp rules: forced row-level security on each table, and a group or room
// can only belong to a session of the same camp and the same session as the assignment that uses it. Needs DATABASE_URL.
describe.skipIf(!url)('groups, rooms and assignments: isolation and constraints', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(6).toString('hex');
  let orgA = '';
  let ownerA = '';
  let sessionA = '';
  let otherSessionA = '';
  let personA = '';
  let groupA = '';
  let roomA = '';

  beforeAll(async () => {
    await migrate(pool);
    orgA = (
      await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Groups camp', $1) RETURNING id`, [
        `groups-${tag}`,
      ])
    ).rows[0].id;
    ownerA = await memberOf(pool, orgA);

    await withOrg(pool, ownerA, orgA, async db => {
      const classId = (
        await db.query<{ id: string }>(
          `INSERT INTO classes (org_id, name, starts_on, ends_on) VALUES ($1, 'Summer 1', '2027-07-05', '2027-07-17') RETURNING id`,
          [orgA],
        )
      ).rows[0].id;
      const otherClassId = (
        await db.query<{ id: string }>(
          `INSERT INTO classes (org_id, name, starts_on, ends_on) VALUES ($1, 'Summer 2', '2027-07-18', '2027-07-30') RETURNING id`,
          [orgA],
        )
      ).rows[0].id;
      sessionA = classId;
      otherSessionA = otherClassId;
      personA = (
        await db.query<{ id: string }>(
          `INSERT INTO people (org_id, given_name, family_name, date_of_birth, phone) VALUES ($1, 'Ada', 'L', '1985-06-15', '+1 555 0100') RETURNING id`,
          [orgA],
        )
      ).rows[0].id;
      groupA = (
        await db.query<{ id: string }>(
          `INSERT INTO groups (org_id, session_id, name, capacity) VALUES ($1, $2, 'Hawks', 4) RETURNING id`,
          [orgA, sessionA],
        )
      ).rows[0].id;
      roomA = (
        await db.query<{ id: string }>(
          `INSERT INTO rooms (org_id, session_id, name, location, capacity) VALUES ($1, $2, 'Lodge 1', 'North', 4) RETURNING id`,
          [orgA, sessionA],
        )
      ).rows[0].id;
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('forces row-level security on groups, rooms and assignments', async () => {
    const { rows } = await pool.query<{ relname: string; relforcerowsecurity: boolean; relrowsecurity: boolean }>(
      `SELECT relname, relforcerowsecurity, relrowsecurity FROM pg_class
        WHERE relname IN ('groups', 'rooms', 'assignments') ORDER BY relname`,
    );
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true });
    }
  });

  it('refuses a group whose session is not the assignment session (the composite foreign key)', async () => {
    await expect(
      withOrg(pool, ownerA, orgA, async db => {
        await db.query(
          `INSERT INTO assignments (org_id, session_id, person_id, role, group_id, room_id)
           VALUES ($1, $2, $3, 'camper', $4, $5)`,
          [orgA, otherSessionA, personA, groupA, roomA],
        );
      }),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('refuses a second active assignment for one person in one session', async () => {
    await expect(
      withOrg(pool, ownerA, orgA, async db => {
        await db.query(
          `INSERT INTO assignments (org_id, session_id, person_id, role, group_id, room_id) VALUES ($1, $2, $3, 'camper', $4, $5)`,
          [orgA, sessionA, personA, groupA, roomA],
        );
        await db.query(
          `INSERT INTO assignments (org_id, session_id, person_id, role, group_id, room_id) VALUES ($1, $2, $3, 'camper', $4, $5)`,
          [orgA, sessionA, personA, groupA, roomA],
        );
      }),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
