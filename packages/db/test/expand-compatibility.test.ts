import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '../src';

const url = process.env.DATABASE_URL;

// The expand step (migration 0032) must keep every function the released v0.2.3 code calls, with the same arguments, so that
// sign-in, camp archive and delete, rename and class edits keep working while both releases run. This test fails if one is
// dropped or changed. It goes when the contract step (packages/db/migrations/0034) drops them on purpose.
const RELEASED_CALLS: [name: string, args: string][] = [
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

describe.skipIf(!url)('expand step keeps the released (v0.2.3) functions', () => {
  const pool = new pg.Pool({ connectionString: url });

  beforeAll(async () => {
    await migrate(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it.each(RELEASED_CALLS)('%s(%s) still exists with the released arguments', async (name, args) => {
    const { rows } = await pool.query<{ found: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = $1 AND pg_get_function_identity_arguments(p.oid) = $2
       ) AS found`,
      [name, args],
    );
    expect(rows[0].found).toBe(true);
  });

  it('the released sign-in call still returns a user’s camps', async () => {
    const user = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, 'Compat') RETURNING id`,
      [`compat-${Math.random().toString(36).slice(2)}@t.test`],
    );
    const { rows } = await pool.query(`SELECT * FROM buxa_memberships_of($1)`, [user.rows[0].id]);
    expect(rows).toEqual([]);
  });
});
