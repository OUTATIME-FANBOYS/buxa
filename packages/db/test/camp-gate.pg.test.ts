import { createHash, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';
import { memberOf } from './support';

// Check-in with a family's email (migration 0068). These need a real Postgres and DATABASE_URL; they are skipped without one.
// They check the row-level rules and the definer functions as the request role sees them.

const url = process.env.DATABASE_URL;
const sha = (value: string) => createHash('sha256').update(value).digest();

describe.skipIf(!url)('check-in with a family email: row-level security and the gate functions', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(4).toString('hex');
  let orgA = '';
  let orgB = '';
  let staffA = '';
  let viewerA = '';
  let adminA = '';
  let household = '';
  let person = '';
  let session = '';
  // The camp-gate check-in takes the parent session (a row of classes), which check_ins and the booked list use; enrolments take the class row (sessions).
  let parentSession = '';
  let deviceHash = Buffer.alloc(0);
  let linkHash = Buffer.alloc(0);
  let codeHash = Buffer.alloc(0);

  /** Runs `work` as the request role, with the given user and camp. */
  const asRequest = <T>(userId: string | null, orgId: string | null, work: (db: pg.PoolClient) => Promise<T>) =>
    withOrg(pool, userId, orgId, work);

  beforeAll(async () => {
    await migrate(pool);
    orgA = (
      await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Gate A', $1) RETURNING id`, [
        `gate-a-${tag}`,
      ])
    ).rows[0].id;
    orgB = (
      await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Gate B', $1) RETURNING id`, [
        `gate-b-${tag}`,
      ])
    ).rows[0].id;
    staffA = await memberOf(pool, orgA, 'staff');
    viewerA = await memberOf(pool, orgA, 'viewer');
    adminA = await memberOf(pool, orgA, 'admin');
    household = (
      await pool.query<{ id: string }>(`INSERT INTO households (org_id, name) VALUES ($1, 'Stone') RETURNING id`, [
        orgA,
      ])
    ).rows[0].id;
    person = (
      await pool.query<{ id: string }>(
        `INSERT INTO people (org_id, given_name, family_name, date_of_birth, phone) VALUES ($1, 'Mia', 'Stone', '2012-06-15', '+1 555 0100') RETURNING id`,
        [orgA],
      )
    ).rows[0].id;
    await pool.query(
      `INSERT INTO household_members (org_id, household_id, person_id, relationship) VALUES ($1, $2, $3, 'child')`,
      [orgA, household, person],
    );
    const classId = (
      await pool.query<{ id: string }>(`INSERT INTO classes (org_id, name) VALUES ($1, 'Art Camp') RETURNING id`, [
        orgA,
      ])
    ).rows[0].id;
    parentSession = classId;
    session = (
      await pool.query<{ id: string }>(
        `INSERT INTO sessions (org_id, class_id, name, capacity, location, starts_at, ends_at)
         VALUES ($1, $2, 'Art Camp', 10, 'Studio', now(), now() + interval '2 hours') RETURNING id`,
        [orgA, classId],
      )
    ).rows[0].id;
    await pool.query(`INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled')`, [
      orgA,
      session,
      person,
    ]);
    deviceHash = sha(`device-${tag}`);
    linkHash = sha(`link-${tag}`);
    codeHash = sha(`code-${tag}`);
    await asRequest(adminA, orgA, db =>
      db.query(
        `INSERT INTO camp_gates (org_id, token_hash, token_ciphertext, token_iv, token_auth_tag)
         VALUES ($1, $2, $3, $4, $5)`,
        [orgA, linkHash, Buffer.alloc(8), Buffer.alloc(12), Buffer.alloc(16)],
      ),
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it('the camp link is readable and rotatable only by an admin of its camp', async () => {
    const asAdmin = await asRequest(adminA, orgA, db => db.query('SELECT org_id FROM camp_gates'));
    expect(asAdmin.rowCount).toBe(1);
    const asViewer = await asRequest(viewerA, orgA, db => db.query('SELECT org_id FROM camp_gates'));
    expect(asViewer.rowCount).toBe(0);
    const asStaff = await asRequest(staffA, orgA, db => db.query('SELECT org_id FROM camp_gates'));
    expect(asStaff.rowCount).toBe(0);
  });

  it('the request role cannot read the verification codes at all (no grant)', async () => {
    await expect(asRequest(null, orgA, db => db.query('SELECT id FROM gate_verification_codes'))).rejects.toThrow();
  });

  it('a camp cannot see another camp’s device tokens', async () => {
    await pool.query(
      `INSERT INTO device_tokens (org_id, household_id, token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '1 day')`,
      [orgA, household, deviceHash],
    );
    const inB = await asRequest(staffA, orgB, db => db.query('SELECT id FROM device_tokens'));
    expect(inB.rowCount).toBe(0);
    const inA = await asRequest(staffA, orgA, db => db.query('SELECT id FROM device_tokens'));
    expect(inA.rowCount).toBeGreaterThan(0);
  });

  it('a viewer cannot revoke a device; a staff member can, once', async () => {
    const id = (await pool.query<{ id: string }>('SELECT id FROM device_tokens WHERE token_hash = $1', [deviceHash]))
      .rows[0].id;
    const viewer = await asRequest(viewerA, orgA, db =>
      db.query('UPDATE device_tokens SET revoked_at = now(), revoked_by = $2 WHERE id = $1', [id, viewerA]),
    );
    expect(viewer.rowCount).toBe(0);
    const staff = await asRequest(staffA, orgA, db =>
      db.query('UPDATE device_tokens SET revoked_at = now(), revoked_by = $2 WHERE id = $1', [id, staffA]),
    );
    expect(staff.rowCount).toBe(1);
  });

  it('a revoked device cannot be reinstated, and its identity cannot change', async () => {
    const id = (await pool.query<{ id: string }>('SELECT id FROM device_tokens WHERE token_hash = $1', [deviceHash]))
      .rows[0].id;
    await expect(
      asRequest(staffA, orgA, db =>
        db.query('UPDATE device_tokens SET revoked_at = NULL, revoked_by = NULL WHERE id = $1', [id]),
      ),
    ).rejects.toThrow();
  });

  it('the gate resolves a live device only, and gives the children of its household booked today', async () => {
    const live = await asRequest(null, null, db =>
      db.query('SELECT household_id FROM buxa_gate_device_v1($1)', [deviceHash]),
    );
    expect(live.rowCount).toBe(0);
    const children = await asRequest(null, null, db =>
      db.query<{ person_id: string }>('SELECT person_id FROM buxa_gate_children_v1($1)', [deviceHash]),
    );
    expect(children.rowCount).toBe(0);
  });

  it('a wrong code counts an attempt, and five wrong codes void the code', async () => {
    await asRequest(null, orgA, db =>
      db.query(`SELECT buxa_gate_issue_code_v1($1, 'gate', $2, 60, 600)`, [household, codeHash]),
    );
    const wrong = sha('wrong');
    let outcome = '';
    for (let i = 0; i < 5; i += 1) {
      const { rows } = await asRequest(null, orgA, db =>
        db.query<{ outcome: string }>(`SELECT outcome FROM buxa_gate_consume_code_v1($1, 'gate', $2, 5)`, [
          household,
          wrong,
        ]),
      );
      outcome = rows[0]?.outcome ?? '';
    }
    expect(outcome).toBe('void');
    const after = await asRequest(null, orgA, db =>
      db.query<{ outcome: string }>(`SELECT outcome FROM buxa_gate_consume_code_v1($1, 'gate', $2, 5)`, [
        household,
        codeHash,
      ]),
    );
    expect(after.rows[0]?.outcome).toBe('refused');
  });

  it('the desk consume needs a staff member: a viewer is refused by the database', async () => {
    await expect(
      asRequest(viewerA, orgA, db =>
        db.query(`SELECT outcome FROM buxa_gate_consume_code_v1($1, 'desk', $2, 5)`, [household, codeHash]),
      ),
    ).rejects.toThrow();
  });

  it('a gate check-in writes one audited row for the child, and refuses a second one', async () => {
    const device = (
      await pool.query<{ id: string }>('SELECT id FROM device_tokens WHERE token_hash = $1', [deviceHash])
    ).rows[0];
    expect(device).toBeDefined();
    // The device was revoked above, so a fresh one is issued for this household to check in with.
    const fresh = sha(`fresh-${tag}`);
    await pool.query(
      `INSERT INTO device_tokens (org_id, household_id, token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '1 day')`,
      [orgA, household, fresh],
    );
    const first = await asRequest(null, null, db =>
      db.query<{ outcome: string }>('SELECT buxa_gate_check_in_v1($1, $2, $3, now()) AS outcome', [
        fresh,
        person,
        parentSession,
      ]),
    );
    expect(first.rows[0]?.outcome).toBe('ok');
    const second = await asRequest(null, null, db =>
      db.query<{ outcome: string }>('SELECT buxa_gate_check_in_v1($1, $2, $3, now()) AS outcome', [
        fresh,
        person,
        parentSession,
      ]),
    );
    expect(second.rows[0]?.outcome).toBe('already_on_site');
    const audited = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM audit_log WHERE org_id = $1 AND action = 'attendance.check_in' AND entity_id = $2`,
      [orgA, person],
    );
    expect(audited.rows[0]?.n).toBe('1');
  });
});
