import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';
import type { Row } from '../types';

const url = process.env.DATABASE_URL;

// Migration 0013: archived_at on the camp row, archive (owner only, audited), the sign-in list that hides archived camps,
// the read-only archived list, and delete (owner only, exact name, cascades to everything in the camp).
describe.skipIf(!url)('camp archive and delete (0013)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(6).toString('hex');
  let owner = '';
  let admin = '';
  let camp = '';

  beforeAll(async () => {
    await migrate(pool);
    const users = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, 'Owner'), ($2, 'Admin') RETURNING id`,
      [`owner-${tag}@archive.test`, `admin-${tag}@archive.test`]);
    [owner, admin] = users.rows.map(r => r.id);
    const created = await pool.query<{ id: string }>(
      `INSERT INTO orgs (name, slug) VALUES ($1, $2) RETURNING id`, [`Archive ${tag}`, `archive-${tag}`]);
    camp = created.rows[0].id;
    await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'admin')`, [camp, owner, admin]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('orgs.archived_at exists, is nullable, and is a timestamp with time zone', async () => {
    const { rows } = await pool.query<{ data_type: string; is_nullable: string }>(
      `SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name = 'orgs' AND column_name = 'archived_at'`);
    expect(rows).toEqual([{ data_type: 'timestamp with time zone', is_nullable: 'YES' }]);
  });

  it('a non-owner cannot archive the camp, and archived_at stays null', async () => {
    await expect(withOrg(pool, camp, db => db.query('SELECT buxa_archive_camp($1, $2)', [camp, admin])))
      .rejects.toThrow(/Only the camp owner/);
    const { rows } = await pool.query<{ archived_at: Date | null }>('SELECT archived_at FROM orgs WHERE id = $1', [camp]);
    expect(rows[0].archived_at).toBeNull();
  });

  it('the owner archives the camp; the archive row is written in the same transaction', async () => {
    await withOrg(pool, camp, db => db.query('SELECT buxa_archive_camp($1, $2)', [camp, owner]));
    const { rows } = await pool.query<{ archived_at: Date | null }>('SELECT archived_at FROM orgs WHERE id = $1', [camp]);
    expect(rows[0].archived_at).not.toBeNull();
    const audit = await pool.query<Row>(`SELECT action FROM audit_log WHERE org_id = $1 AND action = 'org.archive'`, [camp]);
    expect(audit.rowCount).toBe(1);
  });

  it('archiving an archived camp is refused', async () => {
    await expect(withOrg(pool, camp, db => db.query('SELECT buxa_archive_camp($1, $2)', [camp, owner])))
      .rejects.toThrow(/already archived/);
  });

  it('sign-in memberships leave out the archived camp, and the archived list shows it read-only', async () => {
    const memberships = await withOrg(pool, null, db => db.query<{ orgId: string }>(
      'SELECT member_org_id AS "orgId" FROM buxa_memberships_of($1)', [owner])).then(r => r.rows);
    expect(memberships.map(m => m.orgId)).not.toContain(camp);

    const archived = await withOrg(pool, null, db => db.query<{ id: string; name: string; archivedAt: Date; role: string }>(
      'SELECT camp_id AS id, camp_name AS name, camp_archived_at AS "archivedAt", camp_role AS role FROM buxa_archived_camps_of($1)', [admin])).then(r => r.rows);
    expect(archived).toEqual([expect.objectContaining({ id: camp, name: `Archive ${tag}`, role: 'admin' })]);
  });

  it('a non-owner cannot delete the camp', async () => {
    await expect(withOrg(pool, camp, db => db.query('SELECT buxa_delete_camp($1, $2, $3)', [camp, admin, `Archive ${tag}`])))
      .rejects.toThrow(/Only the camp owner/);
    expect((await pool.query('SELECT 1 FROM orgs WHERE id = $1', [camp])).rowCount).toBe(1);
  });

  it('the owner cannot delete with the wrong name (case matters), and nothing is deleted', async () => {
    await expect(withOrg(pool, camp, db => db.query('SELECT buxa_delete_camp($1, $2, $3)', [camp, owner, `archive ${tag}`])))
      .rejects.toThrow(/does not match/);
    expect((await pool.query('SELECT 1 FROM orgs WHERE id = $1', [camp])).rowCount).toBe(1);
  });

  it('the owner deletes with the exact name, and every row in the camp goes with it', async () => {
    // Fill every table that holds camp data for this camp.
    const person = (await pool.query<{ id: string }>(
      `INSERT INTO people (org_id, given_name, family_name) VALUES ($1, 'Ada', 'Lovelace') RETURNING id`, [camp])).rows[0].id;
    await pool.query(`INSERT INTO person_roles (org_id, person_id, role) VALUES ($1, $2, 'camper')`, [camp, person]);
    const household = (await pool.query<{ id: string }>(
      `INSERT INTO households (org_id, name) VALUES ($1, 'Lovelace') RETURNING id`, [camp])).rows[0].id;
    await pool.query(`INSERT INTO household_members (org_id, household_id, person_id, relationship) VALUES ($1, $2, $3, 'child')`, [camp, household, person]);
    await pool.query(`INSERT INTO memberships (org_id, person_id, plan, starts_on, ends_on) VALUES ($1, $2, 'Week', '2026-07-01', '2026-07-07')`, [camp, person]);
    await pool.query(`INSERT INTO credentials (org_id, person_id, token_hash) VALUES ($1, $2, decode(repeat('ab', 32), 'hex'))`, [camp, person]);
    await pool.query(`INSERT INTO check_ins (org_id, person_id, checked_in_at, method) VALUES ($1, $2, now(), 'manual')`, [camp, person]);
    const klass = (await pool.query<{ id: string }>(
      `INSERT INTO classes (org_id, name, default_capacity) VALUES ($1, 'Pottery', 10) RETURNING id`, [camp])).rows[0].id;
    const session = (await pool.query<{ id: string }>(
      `INSERT INTO sessions (org_id, class_id, starts_at, ends_at, location, capacity, ratio_campers, ratio_instructors)
       VALUES ($1, $2, now(), now() + interval '1 hour', 'Studio', 10, 8, 1) RETURNING id`, [camp, klass])).rows[0].id;
    await pool.query(`INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled')`, [camp, session, person]);

    const before = await countCampRows(pool, camp);
    expect(before.people).toBe(1);
    expect(before.audit).toBeGreaterThan(0);

    await withOrg(pool, camp, db => db.query('SELECT buxa_delete_camp($1, $2, $3)', [camp, owner, `Archive ${tag}`]));

    expect(await countCampRows(pool, camp)).toEqual({ orgs: 0, org_members: 0, people: 0, person_roles: 0, households: 0, household_members: 0,
      memberships: 0, credentials: 0, check_ins: 0, classes: 0, sessions: 0, enrolments: 0, audit: 0 });
    // The person's account (a user) is not camp data and stays.
    expect((await pool.query('SELECT 1 FROM users WHERE id = $1', [owner])).rowCount).toBe(1);
  });
});

/** How many rows of each camp table belong to this camp (audit_log included). */
async function countCampRows(pool: pg.Pool, camp: string): Promise<Record<string, number>> {
  const tables: [string, string][] = [
    ['orgs', 'id'], ['org_members', 'org_id'], ['people', 'org_id'], ['person_roles', 'org_id'], ['households', 'org_id'],
    ['household_members', 'org_id'], ['memberships', 'org_id'], ['credentials', 'org_id'], ['check_ins', 'org_id'],
    ['classes', 'org_id'], ['sessions', 'org_id'], ['enrolments', 'org_id'], ['audit_log', 'org_id'],
  ];
  const counts: Record<string, number> = {};
  for (const [table, column] of tables) {
    const { rows } = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${column} = $1`, [camp]);
    counts[table === 'orgs' ? 'orgs' : table === 'audit_log' ? 'audit' : table] = rows[0].n;
  }

  return counts;
}
