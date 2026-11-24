import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '../src';

const url = process.env.DATABASE_URL;

// Every SECURITY DEFINER function runs with its owner's rights, so row-level security does not apply inside it. This test reads
// the catalogue (pg_proc) and fails the build when a function that runs that way (audit 5.3):
//   * takes a user or actor id argument, which the caller could set to another person's id, or
//   * does not read the signed-in user (current_user_id) or the caller's membership (is_member) in its body.
// The exceptions below are explicit and each says why. A stale exception fails the test too.

/** Arguments that name another person rather than the caller. The function checks the caller's role, and the target's membership. */
const TARGET_ARGUMENTS: Record<string, string[]> = {
  buxa_rename_member_v2: ['p_target_user_id'],
  buxa_set_member_option: ['p_user_id'],
  buxa_change_member_role: ['p_user_id'],
  buxa_set_member_expiry: ['p_user_id'],
};

/**
 * Legacy overloads kept for a release that was still serving. The v0.2.3 overloads that took a user as an argument were
 * dropped by the contract step (migration 0034), so the list is empty. Add an entry only with a reason, and remove it once
 * the overload is gone; the stale-entry check below fails on an entry that no longer exists.
 */
const LEGACY_UNTIL_CONTRACT = new Set<string>([]);

/** Functions with no signed-in user by design. Each one returns only what its caller may see without signing in. */
const NO_SIGNED_IN_USER: Record<string, string> = {
  buxa_upsert_user:
    'sign-in: keyed by the verified identity provider id (p_auth_id), before a user row or membership exists',
  buxa_camp_for_calendar_token: 'calendar feed: resolved by the secret token hash, no signed-in user',
  buxa_calendar_feed_classes:
    'calendar feed: the sessions of the one camp that owns the secret token hash, while not archived',
  buxa_teacher_for_calendar_token:
    "teacher calendar feed: the camp of a teacher's own token hash, while the holder is still a teacher (migration 0033)",
  buxa_teacher_calendar_feed_classes:
    'teacher calendar feed: only the classes assigned to the one teacher who owns the token hash (migration 0033)',
  buxa_public_session: 'public session page: returns only public fields, for a camp that is not archived',
  buxa_public_classes: 'public session page: returns only public class fields, for a camp that is not archived',
  buxa_public_classes_v2:
    'public session page: the public class fields plus each class price (migration 0050), for a camp that is not archived',
  rate_limit_hit: 'rate-limit counter: reads and writes only its own key, no tenant data',
  buxa_orgs_with_expired_holds:
    'seat-hold cleanup job (migration 0043): returns camp ids and one member id per camp, takes no argument, and is called only by the CRON_SECRET route',
};

const USER_OR_ACTOR_ARGUMENT = /(user|actor|owner)_?ids?$/i;

describe.skipIf(!url)('SECURITY DEFINER catalogue (audit 5.3)', () => {
  const pool = new pg.Pool({ connectionString: url });

  interface Definer {
    name: string;
    args: string[];
    body: string;
    legacy: boolean;
  }
  let definers: Definer[] = [];

  beforeAll(async () => {
    await migrate(pool);
    // Functions made by an extension are not ours to police. Trigger functions take no arguments and cannot be called.
    // pg_get_function_identity_arguments lists the input arguments only (proargnames would also list RETURNS TABLE columns).
    const { rows } = await pool.query<{ name: string; args: string; body: string }>(`
      SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args, p.prosrc AS body
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.prosecdef
         AND p.prorettype <> 'trigger'::regtype
         AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
       ORDER BY p.proname`);
    definers = rows.map(r => ({
      name: r.name,
      // Each input argument is "name type"; the name is the first word.
      args: r.args
        .split(',')
        .map(a => a.trim().split(' ')[0])
        .filter(a => a !== ''),
      body: r.body,
      legacy: LEGACY_UNTIL_CONTRACT.has(`${r.name}/${r.args.split(',').filter(a => a.trim() !== '').length}`),
    }));
  });

  afterAll(async () => {
    await pool.end();
  });

  it('finds the SECURITY DEFINER functions (the scan is not empty)', () => {
    expect(definers.map(d => d.name)).toContain('buxa_archive_camp');
  });

  it('no SECURITY DEFINER function takes a user or actor id argument, except the named targets', () => {
    const offenders: string[] = [];
    for (const d of definers.filter(x => !x.legacy)) {
      for (const arg of d.args) {
        if (!USER_OR_ACTOR_ARGUMENT.test(arg)) continue;
        if (TARGET_ARGUMENTS[d.name]?.includes(arg)) continue;
        offenders.push(`${d.name}(${arg})`);
      }
    }
    expect(offenders, 'remove the argument and read current_user_id() instead').toEqual([]);
  });

  it('every SECURITY DEFINER function reads the signed-in user or the caller’s membership, or is listed as having no user', () => {
    const offenders = definers
      .filter(d => !d.legacy)
      .filter(d => !NO_SIGNED_IN_USER[d.name])
      .filter(d => !/current_user_id\(\)|is_member\(/.test(d.body))
      .map(d => d.name);
    expect(offenders, 'check membership and role in the function, or list it with a reason').toEqual([]);
  });

  it('every legacy entry still exists, so the list is not stale', () => {
    const current = new Set(definers.map(d => `${d.name}/${d.args.length}`));
    for (const key of LEGACY_UNTIL_CONTRACT) {
      expect(current.has(key), `${key} is listed as legacy but no longer exists: remove the entry`).toBe(true);
    }
  });

  it('the exceptions are still needed: every listed function exists, and every target argument exists', () => {
    const names = new Set(definers.map(d => d.name));
    for (const name of [...Object.keys(NO_SIGNED_IN_USER), ...Object.keys(TARGET_ARGUMENTS)]) {
      expect(names.has(name), `${name} is listed as an exception but is not a SECURITY DEFINER function`).toBe(true);
    }
    for (const [name, args] of Object.entries(TARGET_ARGUMENTS)) {
      const found = definers.find(d => d.name === name);
      for (const arg of args) {
        expect(found?.args, `${name} has no argument ${arg}`).toContain(arg);
      }
    }
  });

  it('pins the search_path and is not executable by PUBLIC', async () => {
    const { rows } = await pool.query<{ name: string; config: string[] | null; public_exec: boolean }>(`
      SELECT p.proname AS name,
             p.proconfig AS config,
             EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
                      WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') AS public_exec
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.prosecdef
         AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')`);
    for (const row of rows) {
      expect(row.config, `${row.name} has no pinned search_path`).toEqual(
        expect.arrayContaining([expect.stringMatching(/^search_path=/)]),
      );
      expect(row.public_exec, `${row.name} is executable by PUBLIC`).toBe(false);
    }
  });
});
