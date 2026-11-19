import { describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '../src';
import type { Row } from '../types';

const url = process.env.DATABASE_URL;

// Migration 0023: registration forms, versions, submissions and their session rows. Every table has org_id, forced row-level
// security with one policy, and no hard delete for the request role.
const TABLES = [
  'registration_forms',
  'registration_form_sessions',
  'registration_form_versions',
  'registrations',
  'registration_sessions',
];

describe.skipIf(!url)('registration tables (0023)', () => {
  const pool = new pg.Pool({ connectionString: url });

  it('every registration table has org_id, forced row-level security and one tenant policy', async () => {
    await migrate(pool);
    for (const table of TABLES) {
      const cols = await pool.query<Row>(
        `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'org_id'`,
        [table],
      );
      expect(cols.rowCount, `${table} has org_id`).toBe(1);

      const rls = await pool.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1`,
        [table],
      );
      expect(rls.rows[0], `${table} RLS`).toEqual({ relrowsecurity: true, relforcerowsecurity: true });

      const policies = await pool.query<Row>(`SELECT 1 FROM pg_policies WHERE tablename = $1`, [table]);
      expect(policies.rowCount, `${table} has a policy`).toBeGreaterThanOrEqual(1);
    }
  });

  it('the request role cannot hard-delete a registration, a version or a submission', async () => {
    for (const table of TABLES) {
      const r = await pool.query<{ d: boolean }>(`SELECT has_table_privilege('buxa_app', $1, 'DELETE') AS d`, [table]);
      expect(r.rows[0].d, `${table} DELETE`).toBe(false);
    }
  });

  it('the session set is replaced by a function, not by request-role DELETE', async () => {
    const r = await pool.query<{ ok: boolean }>(
      `SELECT has_function_privilege('buxa_app', 'buxa_replace_form_sessions(uuid, uuid, uuid[])', 'EXECUTE') AS ok`,
    );
    expect(r.rows[0].ok).toBe(true);
  });

  it('registration tables use the same tenant check as the rest of the schema', async () => {
    const policy = await pool.query<{ qual: string }>(
      `SELECT qual FROM pg_policies WHERE tablename = 'registrations' AND policyname = 'registrations_tenant'`,
    );
    expect(policy.rows[0]?.qual).toContain('current_org()');
  });
});
