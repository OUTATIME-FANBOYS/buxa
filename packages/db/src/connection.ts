import type { Pool, PoolConfig } from 'pg';
import { SUPABASE_ROOT_CA_2021 } from './supabaseRootCa';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * The pg pool settings for a database URL. Remote databases (Supabase) are checked against the Supabase root CA; the
 * sslmode in the URL is removed, because pg would otherwise override this check. Local databases use no TLS.
 */
export function poolConfigFor(
  connectionString: string,
  extra: Omit<PoolConfig, 'connectionString' | 'ssl'> = {},
): PoolConfig {
  const url = new URL(connectionString);
  const local = LOCAL_HOSTS.has(url.hostname);
  url.searchParams.delete('sslmode');
  url.searchParams.delete('uselibpqcompat');

  return {
    ...extra,
    connectionString: url.toString(),
    ssl: local ? false : { ca: SUPABASE_ROOT_CA_2021, rejectUnauthorized: true },
  };
}

/** The attributes of the login a pool connects with. Each flag is true when that login can see past row-level security. */
export interface LoginPrivileges {
  superuser: boolean;
  bypassRls: boolean;
  /** Member, directly or through other roles, of a role that is a superuser or has BYPASSRLS. */
  memberOfPrivilegedRole: boolean;
}

/** Reads the attributes of current_user, including every role it can reach through membership. */
export const LOGIN_PRIVILEGES_SQL = `
  WITH RECURSIVE reachable AS (
    SELECT roleid FROM pg_auth_members WHERE member = (SELECT oid FROM pg_roles WHERE rolname = current_user)
    UNION
    SELECT m.roleid FROM pg_auth_members m JOIN reachable r ON m.member = r.roleid
  )
  SELECT
    EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper) AS superuser,
    EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolbypassrls) AS bypass_rls,
    EXISTS (
      SELECT 1 FROM pg_roles r JOIN reachable ON r.oid = reachable.roleid WHERE r.rolsuper OR r.rolbypassrls
    ) AS member_of_privileged_role`;

/** Shown to operators and returned by /ready. It names the problem and the fix, and never the login or any secret. */
export const UNRESTRICTED_LOGIN_MESSAGE =
  'The database login can bypass row-level security (superuser, BYPASSRLS, or membership of such a role). ' +
  'Connect the app with the restricted runtime login instead. See docs/deploy.md, "Database requirements".';

/** Why a login is not restricted. An empty list means it is restricted. Pure, so it can be tested without a database. */
export function privilegeProblems(privileges: LoginPrivileges): string[] {
  const problems: string[] = [];
  if (privileges.superuser) {
    problems.push('is a superuser');
  }
  if (privileges.bypassRls) {
    problems.push('has BYPASSRLS');
  }
  if (privileges.memberOfPrivilegedRole) {
    problems.push('is a member of a role with SUPERUSER or BYPASSRLS');
  }

  return problems;
}

/** Runs the attribute query on any queryable (a pool, or a client). A missing row is an error, not a pass. */
export async function readLoginPrivileges(db: Pick<Pool, 'query'>): Promise<LoginPrivileges> {
  const result = await db.query<{ superuser: boolean; bypass_rls: boolean; member_of_privileged_role: boolean }>(
    LOGIN_PRIVILEGES_SQL,
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('Could not read the database login attributes');
  }

  return {
    superuser: row.superuser,
    bypassRls: row.bypass_rls,
    memberOfPrivilegedRole: row.member_of_privileged_role,
  };
}

// One query per pool (so per instance). A failed read is forgotten, so the next call tries again.
const verdicts = new WeakMap<Pool, Promise<LoginPrivileges>>();

/** The login's attributes for this pool, read once and remembered. */
export function loginPrivilegesOf(pool: Pool): Promise<LoginPrivileges> {
  let known = verdicts.get(pool);
  if (!known) {
    known = readLoginPrivileges(pool).catch((error: unknown) => {
      verdicts.delete(pool);
      throw error;
    });
    verdicts.set(pool, known);
  }

  return known;
}

/** Throws UNRESTRICTED_LOGIN_MESSAGE when the pool's login can bypass row-level security. A failed read also throws. */
export async function assertRestrictedLogin(pool: Pool): Promise<void> {
  if (privilegeProblems(await loginPrivilegesOf(pool)).length > 0) {
    throw new Error(UNRESTRICTED_LOGIN_MESSAGE);
  }
}
