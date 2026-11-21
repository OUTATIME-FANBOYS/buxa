import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';

const url = process.env.DATABASE_URL;

// The contract step (migration 0034) dropped the v0.2.3 overloads, which took a user or actor id as an argument. The
// released v0.3.1 build calls only the new names, so the old signatures must now be GONE. This test fails if one comes back
// (for example from a rebased migration), because a function that trusts a caller-supplied user id is the audit 5.1 hole.
// It also checks that the new sign-in call, which reads the user from the session, still returns a user's camps.
const RETIRED_SIGNATURES: [name: string, args: string][] = [
  ['buxa_memberships_of', 'p_user_id uuid'],
  ['buxa_archived_camps_of', 'p_user_id uuid'],
  ['buxa_archived_memberships_of', 'p_user_id uuid'],
  ['buxa_archive_camp', 'p_org_id uuid, p_actor_id uuid'],
  ['buxa_unarchive_camp', 'p_org_id uuid, p_actor_id uuid'],
  ['buxa_delete_camp', 'p_org_id uuid, p_actor_id uuid, p_confirm_name text'],
  ['buxa_set_user_name', 'p_user_id uuid, p_first_name text, p_last_name text'],
  ['buxa_set_user_clock_format', 'p_user_id uuid, p_clock_format text'],
  ['buxa_rename_member', 'p_org_id uuid, p_target_user_id uuid, p_name text'],
  ['buxa_delete_class', 'p_org_id uuid, p_class_id uuid'],
  ['buxa_replace_class_instructors', 'p_org_id uuid, p_class_id uuid, p_person_ids uuid[]'],
  ['buxa_replace_class_teachers', 'p_org_id uuid, p_class_id uuid, p_user_ids uuid[]'],
  ['buxa_replace_form_sessions', 'p_org_id uuid, p_form_id uuid, p_session_ids uuid[]'],
  ['buxa_create_org', 'p_name text, p_slug text, p_timezone text, p_owner_id uuid'],
];

describe.skipIf(!url)('contract step retired the v0.2.3 overloads', () => {
  const pool = new pg.Pool({ connectionString: url });

  beforeAll(async () => {
    await migrate(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it.each(RETIRED_SIGNATURES)('%s(%s) no longer exists', async (name, args) => {
    const { rows } = await pool.query<{ found: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = $1 AND pg_get_function_identity_arguments(p.oid) = $2
       ) AS found`,
      [name, args],
    );
    expect(rows[0].found, `${name}(${args}) must be dropped by the contract step`).toBe(false);
  });

  it('the sign-in call, which reads the user from the session, still returns a user’s camps', async () => {
    const user = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, 'Compat') RETURNING id`,
      [`compat-${Math.random().toString(36).slice(2)}@t.test`],
    );
    const { rows } = await withOrg(pool, user.rows[0].id, null, db => db.query('SELECT * FROM buxa_memberships_of()'));
    expect(rows).toEqual([]);
  });
});
