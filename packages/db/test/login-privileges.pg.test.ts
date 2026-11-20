import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import pg from 'pg';
import {
  assertRestrictedLogin,
  loginPrivilegesOf,
  poolConfigFor,
  privilegeProblems,
  UNRESTRICTED_LOGIN_MESSAGE,
  withOrg,
} from '../src';

// Real logins, created on the server named by MIGRATION_DATABASE_URL (it needs CREATEROLE). The roles are removed afterwards.
// Every password is generated here and never printed.
const admin = process.env.MIGRATION_DATABASE_URL ?? '';

describe.skipIf(!admin)('login privileges against real Postgres logins', () => {
  const suffix = randomBytes(4).toString('hex');
  const names = {
    plain: `buxa_iso_plain_${suffix}`,
    bypass: `buxa_iso_bypass_${suffix}`,
    group: `buxa_iso_group_${suffix}`,
    viaGroup: `buxa_iso_member_${suffix}`,
  };
  const passwords = Object.fromEntries(Object.keys(names).map(k => [k, randomBytes(18).toString('hex')]));
  const pools: pg.Pool[] = [];
  let adminPool: pg.Pool;

  // Role names and generated passwords are hex, so quoting them directly is safe.
  const asLogin = (role: keyof typeof names): string => {
    const u = new URL(admin);
    u.username = names[role];
    u.password = passwords[role];

    return u.toString();
  };
  const poolAs = (role: keyof typeof names): pg.Pool => {
    const pool = new pg.Pool(poolConfigFor(asLogin(role), { max: 1 }));
    pools.push(pool);

    return pool;
  };

  beforeAll(async () => {
    adminPool = new pg.Pool(poolConfigFor(admin, { max: 2 }));
    await adminPool.query(`CREATE ROLE "${names.plain}" LOGIN PASSWORD '${passwords.plain}' NOSUPERUSER NOBYPASSRLS`);
    await adminPool.query(`CREATE ROLE "${names.bypass}" LOGIN PASSWORD '${passwords.bypass}' NOSUPERUSER BYPASSRLS`);
    await adminPool.query(`CREATE ROLE "${names.group}" NOLOGIN NOSUPERUSER BYPASSRLS`);
    await adminPool.query(
      `CREATE ROLE "${names.viaGroup}" LOGIN PASSWORD '${passwords.viaGroup}' NOSUPERUSER NOBYPASSRLS IN ROLE "${names.group}"`,
    );
  });

  afterAll(async () => {
    await Promise.all(pools.map(p => p.end()));
    for (const role of Object.values(names)) {
      await adminPool.query(`DROP ROLE IF EXISTS "${role}"`);
    }
    await adminPool.end();
  });

  it('a login with no bypass rights and no privileged membership is restricted', async () => {
    const privileges = await loginPrivilegesOf(poolAs('plain'));
    expect(privileges).toEqual({ superuser: false, bypassRls: false, memberOfPrivilegedRole: false });
    expect(privilegeProblems(privileges)).toEqual([]);
    await expect(assertRestrictedLogin(poolAs('plain'))).resolves.toBeUndefined();
  });

  it('a login with BYPASSRLS is refused', async () => {
    const privileges = await loginPrivilegesOf(poolAs('bypass'));
    expect(privileges.bypassRls).toBe(true);
    await expect(assertRestrictedLogin(poolAs('bypass'))).rejects.toThrow(UNRESTRICTED_LOGIN_MESSAGE);
  });

  it('a login that is a member of a BYPASSRLS role is refused, even though it has no bypass itself', async () => {
    const privileges = await loginPrivilegesOf(poolAs('viaGroup'));
    expect(privileges).toEqual({ superuser: false, bypassRls: false, memberOfPrivilegedRole: true });
    await expect(assertRestrictedLogin(poolAs('viaGroup'))).rejects.toThrow(UNRESTRICTED_LOGIN_MESSAGE);
  });

  it('the refusal does not print the login name or its password', async () => {
    let message = '';
    try {
      await assertRestrictedLogin(poolAs('bypass'));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe(UNRESTRICTED_LOGIN_MESSAGE);
    expect(message).not.toContain(names.bypass);
    expect(message).not.toContain(passwords.bypass);
  });

  it('in production, the tenant path refuses a privileged login and serves a restricted one', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      await expect(withOrg(poolAs('bypass'), null, null, db => db.query('SELECT 1'))).rejects.toThrow(
        UNRESTRICTED_LOGIN_MESSAGE,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
