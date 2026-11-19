import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import {
  assertRestrictedLogin,
  loginPrivilegesOf,
  privilegeProblems,
  readLoginPrivileges,
  UNRESTRICTED_LOGIN_MESSAGE,
} from '../src/connection';

// Unit tests with a fake query result. The real-login tests are in login-privileges.pg.test.ts.
type Row = { superuser: boolean; bypass_rls: boolean; member_of_privileged_role: boolean };
const fakeDb = (rows: Row[]) => ({ query: vi.fn(() => Promise.resolve({ rows })) }) as unknown as Pool;
const restricted: Row = { superuser: false, bypass_rls: false, member_of_privileged_role: false };

describe('login privileges (fake query result)', () => {
  it('maps the query columns to the flags', async () => {
    const db = fakeDb([{ superuser: false, bypass_rls: true, member_of_privileged_role: true }]);
    expect(await readLoginPrivileges(db)).toEqual({ superuser: false, bypassRls: true, memberOfPrivilegedRole: true });
  });

  it('treats a missing row as an error, not as restricted', async () => {
    await expect(readLoginPrivileges(fakeDb([]))).rejects.toThrow('Could not read the database login attributes');
  });

  it('reports no problems for a restricted login, and one problem per privilege it has', () => {
    expect(privilegeProblems({ superuser: false, bypassRls: false, memberOfPrivilegedRole: false })).toEqual([]);
    expect(privilegeProblems({ superuser: true, bypassRls: false, memberOfPrivilegedRole: false })).toEqual([
      'is a superuser',
    ]);
    expect(privilegeProblems({ superuser: false, bypassRls: true, memberOfPrivilegedRole: false })).toEqual([
      'has BYPASSRLS',
    ]);
    expect(privilegeProblems({ superuser: false, bypassRls: false, memberOfPrivilegedRole: true })).toEqual([
      'is a member of a role with SUPERUSER or BYPASSRLS',
    ]);
  });

  it('asserts a restricted login and rejects a privileged one with the fixed message', async () => {
    await expect(assertRestrictedLogin(fakeDb([restricted]))).resolves.toBeUndefined();
    const privileged = fakeDb([{ ...restricted, bypass_rls: true }]);
    await expect(assertRestrictedLogin(privileged)).rejects.toThrow(UNRESTRICTED_LOGIN_MESSAGE);
    expect(UNRESTRICTED_LOGIN_MESSAGE).not.toMatch(/postgres:\/\/|password/i);
  });

  it('reads the login once per pool, and forgets a failed read so the next call tries again', async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValue({ rows: [restricted] });
    const pool = { query } as unknown as Pool;
    await expect(loginPrivilegesOf(pool)).rejects.toThrow('connection reset');
    await expect(loginPrivilegesOf(pool)).resolves.toEqual({
      superuser: false,
      bypassRls: false,
      memberOfPrivilegedRole: false,
    });
    await loginPrivilegesOf(pool);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
