import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '../src';

const url = process.env.DATABASE_URL;

describe.skipIf(!url)('schema guarantees', () => {
  const pool = new pg.Pool({ connectionString: url });
  beforeAll(() => migrate(pool));
  afterAll(() => pool.end());

  describe('every table is protected', () => {
    it('has row-level security enabled, forced, and at least one policy (a new table without them fails here)', async () => {
      const tables = (await pool.query<{ name: string; enabled: boolean; forced: boolean; policies: number }>(`
        SELECT c.relname AS name, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
               (SELECT count(*)::int FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'schema_migrations'
         ORDER BY c.relname`)).rows;
      expect(tables.map(t => t.name)).toEqual(expect.arrayContaining(['audit_log', 'org_members', 'orgs', 'users']));
      for (const t of tables) expect(t, `table ${t.name}`).toMatchObject({ enabled: true, forced: true });
      for (const t of tables) expect(t.policies, `policies on ${t.name}`).toBeGreaterThan(0);
    });

    it('the request role cannot read the migration bookkeeping table', async () => {
      const r = await pool.query(`SELECT has_table_privilege('buxa_app', 'schema_migrations', 'SELECT') AS can`);
      expect(r.rows[0].can).toBe(false);
    });
  });

  describe('the audit log is append-only', () => {
    const tag = Math.random().toString(36).slice(2, 8);
    let orgId = '', userId = '';
    beforeAll(async () => {
      orgId = (await pool.query(`INSERT INTO orgs(name, slug) VALUES ('Audit Camp', $1) RETURNING id`, [`audit-${tag}`])).rows[0].id;
      userId = (await pool.query(`INSERT INTO users(email, name) VALUES ($1, 'Aud') RETURNING id`, [`aud-${tag}@a.test`])).rows[0].id;
      await pool.query(`INSERT INTO audit_log(org_id, actor_id, action, entity) VALUES ($1, $2, 'seed', 'org')`, [orgId, userId]);
    });
    afterAll(async () => {
      await pool.query('DELETE FROM orgs WHERE id = $1', [orgId]);
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    });

    it('refuses a direct DELETE, even from the owner role (the trigger, not a missing grant)', async () => {
      await expect(pool.query('DELETE FROM audit_log WHERE org_id = $1', [orgId])).rejects.toThrow(/append-only/);
    });
    it('refuses any direct UPDATE, including clearing actor_id', async () => {
      await expect(pool.query(`UPDATE audit_log SET action = 'edited' WHERE org_id = $1`, [orgId])).rejects.toThrow(/append-only/);
      await expect(pool.query('UPDATE audit_log SET actor_id = NULL WHERE org_id = $1', [orgId])).rejects.toThrow(/append-only/);
    });
    it('refuses TRUNCATE', async () => {
      await expect(pool.query('TRUNCATE audit_log')).rejects.toThrow(/cannot be truncated/);
    });
    it('still lets deleting a user clear actor_id (erasure) without touching anything else', async () => {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      const row = (await pool.query('SELECT actor_id, action FROM audit_log WHERE org_id = $1', [orgId])).rows[0];
      expect(row).toEqual({ actor_id: null, action: 'seed' });
    });
    it('still lets deleting an organisation remove its audit rows (erasure)', async () => {
      await pool.query('DELETE FROM orgs WHERE id = $1', [orgId]);
      expect((await pool.query('SELECT 1 FROM audit_log WHERE org_id = $1', [orgId])).rowCount).toBe(0);
    });
  });
});

describe.skipIf(!url)('Supabase Data API is locked out', () => {
  const pool = new pg.Pool({ connectionString: url });
  afterAll(() => pool.end());

  // The roles only exist on Supabase. Where they do, they must hold no privileges on any of our tables.
  it('anon and authenticated have no privileges on any table in public (when those roles exist)', async () => {
    const roles = (await pool.query<{ rolname: string }>(`SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')`)).rows.map(r => r.rolname);
    const tables = (await pool.query<{ t: string }>(`SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public'`)).rows.map(r => r.t);
    for (const role of roles) for (const table of tables) {
      const r = await pool.query(`SELECT has_table_privilege($1, format('public.%I', $2::text), 'SELECT,INSERT,UPDATE,DELETE') AS any`, [role, table]);
      expect(r.rows[0].any, `${role} on ${table}`).toBe(false);
    }
  });
});
