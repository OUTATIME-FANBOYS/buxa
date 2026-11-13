import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { ROLES } from '@buxa/domain';
import { migrate, withOrg } from '../src';

const url = process.env.DATABASE_URL;
// These need a real Postgres: `docker compose up -d db` and DATABASE_URL (see .env.example). CI provides one.
describe.skipIf(!url)('tenant isolation (row-level security)', () => {
  const pool = new pg.Pool({ connectionString: url });
  let a = '', b = '', ua = '', ub = '';
  const tag = Math.random().toString(36).slice(2, 8);

  beforeAll(async () => {
    await migrate(pool);
    a = (await pool.query(`INSERT INTO orgs(name, slug) VALUES ('Camp A', $1) RETURNING id`, [`camp-a-${tag}`])).rows[0].id;
    b = (await pool.query(`INSERT INTO orgs(name, slug) VALUES ('Camp B', $1) RETURNING id`, [`camp-b-${tag}`])).rows[0].id;
    ua = (await pool.query(`INSERT INTO users(email, name) VALUES ($1, 'Ann') RETURNING id`, [`ann-${tag}@a.test`])).rows[0].id;
    ub = (await pool.query(`INSERT INTO users(email, name) VALUES ($1, 'Bo') RETURNING id`, [`bo-${tag}@b.test`])).rows[0].id;
    await pool.query(`INSERT INTO org_members(org_id, user_id, role) VALUES ($1,$2,'owner'), ($3,$4,'owner')`, [a, ua, b, ub]);
    await pool.query(`INSERT INTO audit_log(org_id, actor_id, action, entity) VALUES ($1,$2,'seed','org'), ($3,$4,'seed','org')`, [a, ua, b, ub]);
  });
  afterAll(async () => {
    await pool.query('DELETE FROM orgs WHERE id = ANY($1)', [[a, b]]).catch(() => {});
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [[ua, ub]]);
    await pool.end();
  });

  it('the request role cannot bypass row-level security', async () => {
    const r = await pool.query(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'buxa_app'`);
    expect(r.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it('sees only its own organisation, members, users and audit rows', async () => {
    await withOrg(pool, a, async db => {
      expect((await db.query('SELECT id FROM orgs')).rows.map(r => r.id)).toEqual([a]);
      expect((await db.query('SELECT user_id FROM org_members')).rows.map(r => r.user_id)).toEqual([ua]);
      expect((await db.query('SELECT id FROM users')).rows.map(r => r.id)).toEqual([ua]);
      expect((await db.query('SELECT org_id FROM audit_log')).rows.every(r => r.org_id === a)).toBe(true);
    });
  });

  it('with no organisation set, every tenant table is empty', async () => {
    await withOrg(pool, null, async db => {
      for (const t of ['orgs', 'users', 'org_members', 'audit_log']) expect((await db.query(`SELECT 1 FROM ${t}`)).rowCount).toBe(0);
    });
  });

  it('cannot write into another organisation', async () => {
    await expect(withOrg(pool, a, db => db.query(`INSERT INTO org_members(org_id, user_id, role) VALUES ($1,$2,'viewer')`, [b, ua]))).rejects.toThrow(/row-level security/);
    await expect(withOrg(pool, a, db => db.query(`INSERT INTO audit_log(org_id, action, entity) VALUES ($1,'x','y')`, [b]))).rejects.toThrow(/row-level security/);
  });

  it('cannot change or delete another organisation’s rows (silently affects nothing)', async () => {
    await withOrg(pool, a, async db => {
      expect((await db.query(`UPDATE orgs SET name = 'hacked' WHERE id = $1`, [b])).rowCount).toBe(0);
      expect((await db.query(`DELETE FROM org_members WHERE org_id = $1`, [b])).rowCount).toBe(0);
    });
    expect((await pool.query('SELECT name FROM orgs WHERE id = $1', [b])).rows[0].name).toBe('Camp B');
  });

  it('cannot move a row to another organisation by updating org_id', async () => {
    await expect(withOrg(pool, a, db => db.query(`UPDATE org_members SET org_id = $1 WHERE org_id = $2`, [b, a]))).rejects.toThrow(/row-level security/);
  });

  it('the audit log is append-only, even for the owner role', async () => {
    await expect(withOrg(pool, a, db => db.query(`DELETE FROM audit_log`))).rejects.toThrow();
    await expect(pool.query(`UPDATE audit_log SET action = 'edited' WHERE org_id = $1`, [a])).rejects.toThrow(/append-only/);
    await withOrg(pool, a, db => db.query(`INSERT INTO audit_log(org_id, action, entity) VALUES ($1,'ok','org')`, [a]));
  });

  it('rejects a malformed organisation id before it reaches SQL', async () => {
    await expect(withOrg(pool, `'; DROP TABLE orgs; --`, async () => 1)).rejects.toThrow(/Invalid organisation id/);
  });

  it('database roles match the permissions module (no drift)', async () => {
    const r = await pool.query(`SELECT unnest(enum_range(NULL::org_role))::text AS role`);
    expect(r.rows.map(x => x.role).sort()).toEqual([...ROLES].sort());
  });

  it('migrations are idempotent', async () => { expect(await migrate(pool)).toEqual([]); });
});
