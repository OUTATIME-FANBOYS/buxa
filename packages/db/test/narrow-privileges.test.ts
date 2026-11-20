import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';
import type { Row } from '../types';

const url = process.env.DATABASE_URL;

// Audit S-06. The request role (buxa_app) must not reach the migration history or bypass row-level security, and the
// three privileged paths must be the only cross-organisation functions it can run.
describe.skipIf(!url)('narrow privileges (S-06)', () => {
  const pool = new pg.Pool({ connectionString: url });
  beforeAll(async () => {
    await migrate(pool);
  });
  afterAll(async () => {
    await pool.end();
  });

  it('the request role cannot read the migration history', async () => {
    await expect(withOrg(pool, null, null, db => db.query<Row>('SELECT name FROM schema_migrations'))).rejects.toThrow(
      /permission denied/,
    );
  });

  it('the request role has no bypass, no superuser and no CREATEROLE', async () => {
    const r = await pool.query<Row>(
      `SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = 'buxa_app'`,
    );
    expect(r.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false });
  });

  it('the request role cannot write users or organisations directly (only through the functions)', async () => {
    const r = await pool.query<Row>(`SELECT
        has_table_privilege('buxa_app', 'users', 'INSERT') AS users_insert,
        has_table_privilege('buxa_app', 'orgs', 'INSERT') AS orgs_insert,
        has_table_privilege('buxa_app', 'users', 'SELECT') AS users_select`);
    expect(r.rows[0]).toEqual({ users_insert: false, orgs_insert: false, users_select: true });
  });

  it('the three privileged functions are SECURITY DEFINER with a fixed search_path', async () => {
    const r = await pool.query<{ proname: string; prosecdef: boolean; proconfig: string[] | null }>(
      `SELECT proname, prosecdef, proconfig FROM pg_proc WHERE proname IN ('buxa_upsert_user', 'buxa_memberships_of', 'buxa_create_org') ORDER BY proname`,
    );
    expect(r.rows).toHaveLength(3);
    for (const row of r.rows) {
      expect(row.prosecdef, row.proname).toBe(true);
      expect(row.proconfig, row.proname).toEqual(['search_path=pg_catalog, public']);
    }
  });

  it('the functions are executable by the request role and by no one else (not PUBLIC)', async () => {
    const sigs = ['buxa_upsert_user(uuid,text,text)', 'buxa_memberships_of()', 'buxa_create_org(text,text,text)'];
    for (const sig of sigs) {
      const r = await pool.query<Row>(`SELECT has_function_privilege('buxa_app', $1, 'EXECUTE') AS app`, [sig]);
      expect(r.rows[0].app, sig).toBe(true);
    }
    // PUBLIC is grantee 0 in the ACL (has_function_privilege takes role names, not PUBLIC).
    const publicGrants = await pool.query<Row>(`SELECT count(*)::int AS n FROM pg_proc p, aclexplode(p.proacl) a
                                            WHERE p.proname IN ('buxa_upsert_user', 'buxa_memberships_of', 'buxa_create_org') AND a.grantee = 0`);
    expect(publicGrants.rows[0].n).toBe(0);
  });

  it('the request role can run the sign-in and organisation functions, and reads nothing without an organisation', async () => {
    const tag = Math.random().toString(36).slice(2, 10);
    const authId = (await pool.query<{ id: string }>('SELECT gen_random_uuid() AS id')).rows[0].id;
    const user = await withOrg(pool, null, null, db =>
      db.query<{ id: string }>('SELECT user_id AS id FROM buxa_upsert_user($1, $2, $3)', [
        authId,
        `owner-${tag}@privs.test`,
        'Owner',
      ]),
    ).then(r => r.rows[0]);
    expect(user.id).toBeTruthy();
    const org = await withOrg(pool, user.id, null, db =>
      db.query<{ id: string }>('SELECT org_id AS id FROM buxa_create_org($1, $2, $3)', [
        `Privs ${tag}`,
        `privs-${tag}`,
        'UTC',
      ]),
    ).then(r => r.rows[0]);
    const memberships = await withOrg(pool, user.id, null, db =>
      db.query<{ orgId: string }>('SELECT member_org_id AS "orgId" FROM buxa_memberships_of()'),
    ).then(r => r.rows);
    expect(memberships.map(m => m.orgId)).toContain(org.id);
    // Without an organisation, the tables themselves stay empty.
    expect((await withOrg(pool, null, null, db => db.query<Row>('SELECT 1 FROM orgs'))).rowCount).toBe(0);
  });
});
