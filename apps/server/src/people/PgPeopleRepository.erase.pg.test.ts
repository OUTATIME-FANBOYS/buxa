import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { isHttpError } from '../http/errors';
import { PgPeopleRepository } from './PgPeopleRepository';

const url = process.env.DATABASE_URL;

// buxa_delete_person (migration 0040) runs as the owner. Only the camp owner may delete, the person's memberships and credentials
// go with the person through the foreign-key cascades, and the deletion is audited. Runs only with DATABASE_URL (test:db).
describe.skipIf(!url)('PgPeopleRepository.erase', () => {
  const pool = new pg.Pool({ connectionString: url });
  const repo = new PgPeopleRepository(pool);
  const tag = randomBytes(6).toString('hex');
  let owner = '';
  let staff = '';
  let orgId = '';

  beforeAll(async () => {
    await migrate(pool);
    const users = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, 'Owner'), ($2, 'Staff') RETURNING id`,
      [`owner-${tag}@erase.test`, `staff-${tag}@erase.test`],
    );
    [owner, staff] = users.rows.map(r => r.id);
    const org = await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ($1, $2) RETURNING id`, [
      `Erase ${tag}`,
      `erase-${tag}`,
    ]);
    orgId = org.rows[0].id;
    await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'staff')`, [
      orgId,
      owner,
      staff,
    ]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('refuses staff with 403 and leaves the person in place', async () => {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO people (org_id, given_name, family_name, date_of_birth, phone) VALUES ($1, 'Keep', 'Me', '1985-06-15', '+1 555 0100') RETURNING id`,
      [orgId],
    );
    const asStaff = { userId: staff, orgId, role: 'staff' as const };

    const refused = await repo.erase(asStaff, rows[0].id).catch((e: unknown) => e);

    expect(isHttpError(refused) && refused.statusCode).toBe(403);
    const still = await pool.query(`SELECT 1 FROM people WHERE id = $1`, [rows[0].id]);
    expect(still.rowCount).toBe(1);
  });

  it('the owner deletes the person and their linked rows, and writes the audit entry', async () => {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO people (org_id, given_name, family_name, date_of_birth, phone) VALUES ($1, 'Remove', 'Me', '1985-06-15', '+1 555 0100') RETURNING id`,
      [orgId],
    );
    const personId = rows[0].id;
    await pool.query(
      `INSERT INTO memberships (org_id, person_id, plan, starts_on, ends_on) VALUES ($1, $2, 'Full week', '2027-07-10', '2027-07-17')`,
      [orgId, personId],
    );

    await repo.erase({ userId: owner, orgId, role: 'owner' }, personId);

    expect((await pool.query(`SELECT 1 FROM people WHERE id = $1`, [personId])).rowCount).toBe(0);
    expect((await pool.query(`SELECT 1 FROM memberships WHERE person_id = $1`, [personId])).rowCount).toBe(0);
    const audit = await pool.query(
      `SELECT 1 FROM audit_log WHERE org_id = $1 AND action = 'person.delete' AND entity_id = $2`,
      [orgId, personId],
    );
    expect(audit.rowCount).toBe(1);
  });
});
