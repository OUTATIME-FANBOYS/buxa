import { describe, expect, it } from 'vitest';
import { ACTIONS, authorize, can, ROLES, type Action, type Actor, type Role } from '../src';

const ORG = 'org-1';
const archived = (role: Role): Actor => ({ userId: 'me', orgId: ORG, role, archived: true });
const READ_ONLY = (action: Action) =>
  action.endsWith(':read') || action.endsWith(':read_contact') || action === 'attendance:export';

describe('archived camps (read-only)', () => {
  it.each(ROLES)('a %s may read an archived camp, for every read action', role => {
    for (const action of ACTIONS.filter(READ_ONLY)) {
      const decision = authorize(archived(role), action);
      // Some reads are not granted to every role; the archive rule must never be the reason for a refusal.
      expect(decision.allow || decision.reason !== 'archived_camp').toBe(true);
    }
    expect(can(archived('viewer'), 'org:read')).toBe(true);
    expect(can(archived('owner'), 'attendance:read')).toBe(true);
  });

  it.each(ROLES)('a %s is refused every write in an archived camp, with the archived reason', role => {
    for (const action of ACTIONS.filter(a => !READ_ONLY(a) && a !== 'org:delete' && a !== 'org:unarchive')) {
      expect(authorize(archived(role), action)).toEqual({ allow: false, reason: 'archived_camp' });
    }
  });

  it('only the owner may unarchive or delete an archived camp; everyone else is refused by role', () => {
    expect(can(archived('owner'), 'org:unarchive', { orgId: ORG })).toBe(true);
    expect(authorize(archived('admin'), 'org:unarchive', { orgId: ORG })).toEqual({
      allow: false,
      reason: 'role_not_allowed',
    });
    expect(can(archived('owner'), 'org:delete', { orgId: ORG })).toBe(true);
    expect(authorize(archived('admin'), 'org:delete', { orgId: ORG })).toEqual({
      allow: false,
      reason: 'role_not_allowed',
    });
  });

  it('an active camp is not affected by the flag being absent or false', () => {
    expect(can({ userId: 'me', orgId: ORG, role: 'staff' }, 'attendance:record')).toBe(true);
    expect(can({ userId: 'me', orgId: ORG, role: 'staff', archived: false }, 'attendance:record')).toBe(true);
  });
});
