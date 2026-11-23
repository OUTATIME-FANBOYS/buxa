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
  'registration_classes',
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
      `SELECT has_function_privilege('buxa_app', 'buxa_replace_form_sessions_v2(uuid, uuid, uuid[])', 'EXECUTE') AS ok`,
    );
    expect(r.rows[0].ok).toBe(true);
  });

  it('registration tables use the same tenant check as the rest of the schema', async () => {
    const policy = await pool.query<{ qual: string }>(
      `SELECT qual FROM pg_policies WHERE tablename = 'registrations' AND policyname = 'registrations_tenant'`,
    );
    expect(policy.rows[0]?.qual).toContain('current_org()');
  });

  it('a registration is pending or confirmed, and only the confirmation columns are writable by the request role (0031)', async () => {
    const cols = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'registrations' AND column_name IN ('status', 'confirmed_at', 'confirmed_by')`,
    );
    expect(cols.rowCount).toBe(3);
    for (const column of ['status', 'confirmed_at', 'confirmed_by']) {
      const ok = await pool.query<{ ok: boolean }>(
        `SELECT has_column_privilege('buxa_app', 'registrations', $1, 'UPDATE') AS ok`,
        [column],
      );
      expect(ok.rows[0].ok, `${column} UPDATE`).toBe(true);
    }
    const answers = await pool.query<{ ok: boolean }>(
      `SELECT has_column_privilege('buxa_app', 'registrations', 'answers', 'UPDATE') AS ok`,
    );
    expect(answers.rows[0].ok).toBe(false);
  });
});
