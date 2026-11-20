import { createHash, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';
import type { Row } from '../types';

const url = process.env.DATABASE_URL;

/** A random 32-byte token hash, as the service stores it. */
const newHash = (): Buffer => createHash('sha256').update(randomBytes(32)).digest();

// These need a real Postgres: DATABASE_URL and a migrated database (CI provides one). They check migration 0037 directly:
// buxa_accept_invite accepts once and refuses a second use, a different email and an expired invite; the profile function
// writes only the signed-in person's row; and the invite table is visible to staff and above only.
describe.skipIf(!url)('teacher invites (migration 0037)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = Math.random().toString(36).slice(2, 8);
  const annEmail = `ann-${tag}@b.test`;
  const liveHash = newHash();
  const expiredHash = newHash();
  const wrongEmailHash = newHash();
  const unknownHash = newHash();
  let org = '';
  let staff = '';
  let ann = '';
  let bo = '';

  beforeAll(async () => {
    await migrate(pool);
    org = (
      await pool.query<{ id: string }>(`INSERT INTO orgs(name, slug) VALUES ('Invite Camp', $1) RETURNING id`, [
        `invite-${tag}`,
      ])
    ).rows[0].id;
    staff = (
      await pool.query<{ id: string }>(
        `INSERT INTO users(email, name, first_name) VALUES ($1, 'Sam Staff', 'Sam') RETURNING id`,
        [`sam-${tag}@a.test`],
      )
    ).rows[0].id;
    ann = (
      await pool.query<{ id: string }>(
        `INSERT INTO users(email, name, first_name) VALUES ($1, 'Ann', 'Ann') RETURNING id`,
        [annEmail],
      )
    ).rows[0].id;
    bo = (
      await pool.query<{ id: string }>(
        `INSERT INTO users(email, name, first_name) VALUES ($1, 'Bo', 'Bo') RETURNING id`,
        [`bo-${tag}@b.test`],
      )
    ).rows[0].id;
    await pool.query<Row>(`INSERT INTO org_members(org_id, user_id, role) VALUES ($1, $2, 'staff')`, [org, staff]);
    await pool.query<Row>(
      `INSERT INTO member_invites(org_id, email, name, role, token_hash, created_by)
       VALUES ($1, $2, 'Ann Lee', 'teacher', $3, $4), ($1, $5, 'Wrong Person', 'teacher', $6, $4)`,
      [org, annEmail, liveHash, staff, annEmail, wrongEmailHash],
    );
    await pool.query<Row>(
      `INSERT INTO member_invites(org_id, email, name, role, token_hash, created_by, expires_at)
       VALUES ($1, $2, 'Ann Lee', 'teacher', $3, $4, now() - interval '1 day')`,
      [org, annEmail, expiredHash, staff],
    );
  });

  afterAll(async () => {
    await pool.query<Row>('DELETE FROM orgs WHERE id = $1', [org]);
    await pool.query<Row>('DELETE FROM users WHERE id = ANY($1)', [[staff, ann, bo]]);
    await pool.end();
  });

  /** The constraint tag the refusal carries, or null when the call succeeded. */
  const refusalOf = async (work: Promise<unknown>): Promise<string | null> => {
    try {
      await work;

      return null;
    } catch (error) {
      return error instanceof Error && 'constraint' in error && typeof error.constraint === 'string'
        ? error.constraint
        : null;
    }
  };

  it('accepts a live invite once, joins the person as a teacher, and records who accepted it', async () => {
    const joined = await withOrg(pool, ann, null, db =>
      db.query<{ org_id: string; org_name: string }>('SELECT org_id, org_name FROM buxa_accept_invite($1)', [liveHash]),
    );

    expect(joined.rows).toEqual([{ org_id: org, org_name: 'Invite Camp' }]);
    const membership = await pool.query<{ role: string }>(
      'SELECT role::text AS role FROM org_members WHERE org_id = $1 AND user_id = $2',
      [org, ann],
    );
    expect(membership.rows).toEqual([{ role: 'teacher' }]);
    const accepted = await pool.query<{ accepted_by: string | null }>(
      'SELECT accepted_by FROM member_invites WHERE token_hash = $1',
      [liveHash],
    );
    expect(accepted.rows).toEqual([{ accepted_by: ann }]);
  });

  it('refuses a second use of the same invite with the generic reason', async () => {
    const constraint = await refusalOf(
      withOrg(pool, ann, null, db => db.query<Row>('SELECT * FROM buxa_accept_invite($1)', [liveHash])),
    );

    expect(constraint).toBe('invite_unusable');
  });

  it('refuses an invite for another email address, and the person is not joined', async () => {
    const constraint = await refusalOf(
      withOrg(pool, bo, null, db => db.query<Row>('SELECT * FROM buxa_accept_invite($1)', [wrongEmailHash])),
    );

    expect(constraint).toBe('invite_wrong_email');
    const membership = await pool.query<Row>('SELECT 1 FROM org_members WHERE org_id = $1 AND user_id = $2', [org, bo]);
    expect(membership.rowCount).toBe(0);
  });

  it('refuses an expired invite and an unknown token with the same generic reason', async () => {
    const expired = await refusalOf(
      withOrg(pool, ann, null, db => db.query<Row>('SELECT * FROM buxa_accept_invite($1)', [expiredHash])),
    );
    const unknown = await refusalOf(
      withOrg(pool, bo, null, db => db.query<Row>('SELECT * FROM buxa_accept_invite($1)', [unknownHash])),
    );

    expect(expired).toBe('invite_unusable');
    expect(unknown).toBe('invite_unusable');
  });

  it('a refused join rolls back the profile written in the same transaction', async () => {
    const constraint = await refusalOf(
      withOrg(pool, bo, null, async db => {
        await db.query('SELECT buxa_set_user_profile($1, $2, $3)', ['Robert', 'Changed', null]);
        await db.query('SELECT * FROM buxa_accept_invite($1)', [wrongEmailHash]);
      }),
    );

    expect(constraint).toBe('invite_wrong_email');
    const profile = await pool.query<{ first_name: string }>('SELECT first_name FROM users WHERE id = $1', [bo]);
    expect(profile.rows).toEqual([{ first_name: 'Bo' }]);
  });

  it('the profile function writes only the signed-in person’s own row', async () => {
    await withOrg(pool, ann, null, db =>
      db.query('SELECT buxa_set_user_profile($1, $2, $3)', ['Anne', 'Lee', '+61 400 000 001']),
    );

    const rows = await pool.query<{ id: string; first_name: string; last_name: string | null; phone: string | null }>(
      'SELECT id, first_name, last_name, phone FROM users WHERE id = ANY($1) ORDER BY first_name',
      [[ann, bo]],
    );
    expect(rows.rows).toEqual([
      { id: ann, first_name: 'Anne', last_name: 'Lee', phone: '+61 400 000 001' },
      { id: bo, first_name: 'Bo', last_name: null, phone: null },
    ]);
  });

  it('staff can read the camp’s invites, and a teacher or a stranger sees none', async () => {
    const asStaff = await withOrg(pool, staff, org, db => db.query<Row>('SELECT id FROM member_invites'));
    const asTeacher = await withOrg(pool, ann, org, db => db.query<Row>('SELECT id FROM member_invites'));

    expect(asStaff.rowCount).toBeGreaterThan(0);
    expect(asTeacher.rowCount).toBe(0);
  });

  it('the request role cannot delete an invite, and can change only the token and its expiry', async () => {
    await expect(
      withOrg(pool, staff, org, db => db.query<Row>('DELETE FROM member_invites WHERE org_id = $1', [org])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      withOrg(pool, staff, org, db =>
        db.query<Row>(`UPDATE member_invites SET accepted_at = now() WHERE org_id = $1`, [org]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
