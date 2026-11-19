import { describe, expect, it } from 'vitest';
import { ACTIONS, GRANTS, ROLES, authorize, can, rank, type Action, type Actor, type Role } from '../src';

const ORG = 'org-1';
const as = (role: Role, userId = 'me'): Actor => ({ userId, orgId: ORG, role });

// The matrix, written out so a reviewer can read it. Y = allowed, . = denied.
//                          viewer staff admin owner
const MATRIX: Record<Action, string> = {
  'org:read': 'YYYY',
  'org:update': '..YY',
  'org:archive': '...Y',
  'org:delete': '...Y',
  'org:unarchive': '...Y',
  'org:transfer_ownership': '...Y',
  'members:read': 'YYYY',
  'members:read_contact': '..YY',
  'members:invite': '..YY',
  'members:change_role': '..YY',
  'members:remove': '..YY',
  'members:rename': '..YY',
  'members:leave': 'YYYY',
  'audit:read': '..YY',
  'data:export': '...Y',
  'data:erase': '...Y',
  'people:read': 'YYYY',
  'people:read_contact': '.YYY',
  'people:create': '.YYY',
  'people:update': '.YYY',
  'people:delete': '..YY',
  'people:authorise_pickup': '..YY',
  'memberships:manage': '..YY',
  'credentials:manage': '..YY',
  'attendance:read': '.YYY',
  'attendance:record': '.YYY',
  'attendance:override': '..YY',
  'attendance:export': '..YY',
  'events:read': 'YYYY',
  'events:create': '..YY',
  'events:update': '..YY',
  'events:delete': '..YY',
  'classes:manage': '.YYY',
  'holds:manage': '.YYY',
  'tasks:read': 'YYYY',
  'tasks:create': '.YYY',
  'tasks:update': '.YYY',
  'tasks:move': '.YYY',
  'tasks:comment': '.YYY',
  'tasks:delete': '..YY',
  'tasks:manage_board': '..YY',
  'registration:read': '.YYY',
  'registration:submit': '.YYY',
  'registration:manage': '..YY',
};

describe('role grants', () => {
  it('the table covers every action and nothing else', () => {
    expect(Object.keys(MATRIX).sort()).toEqual([...ACTIONS].sort());
  });

  for (const action of ACTIONS) {
    it(`${action}`, () => {
      const got = ROLES.map(r => (GRANTS[r].has(action) ? 'Y' : '.')).join('');
      expect(got).toBe(MATRIX[action]);
    });
  }

  it('a higher role never has fewer grants than a lower one', () => {
    for (let i = 1; i < ROLES.length; i++) {
      for (const a of GRANTS[ROLES[i - 1]]) {
        expect(GRANTS[ROLES[i]].has(a)).toBe(true);
      }
    }
  });
});

describe('fail closed', () => {
  it('denies every action for another organisation', () => {
    for (const r of ROLES) {
      for (const a of ACTIONS) {
        expect(authorize(as(r), a, { orgId: 'org-2' })).toEqual({ allow: false, reason: 'other_org' });
      }
    }
  });
  it('denies an unknown role', () => {
    expect(authorize({ userId: 'x', orgId: ORG, role: 'god' as Role }, 'org:read')).toEqual({
      allow: false,
      reason: 'unknown_role',
    });
  });
  it('denies member actions when context is missing', () => {
    expect(authorize(as('owner'), 'members:invite')).toEqual({ allow: false, reason: 'missing_context' });
    expect(authorize(as('owner'), 'members:change_role', { newRole: 'staff' })).toEqual({
      allow: false,
      reason: 'missing_context',
    });
    expect(authorize(as('owner'), 'members:remove')).toEqual({ allow: false, reason: 'missing_context' });
    expect(authorize(as('owner'), 'members:leave')).toEqual({ allow: false, reason: 'missing_context' });
    expect(authorize(as('owner'), 'org:transfer_ownership')).toEqual({ allow: false, reason: 'missing_context' });
  });
  it('a role the grant table denies cannot be rescued by context', () => {
    expect(can(as('staff'), 'members:invite', { newRole: 'viewer' })).toBe(false);
    expect(can(as('viewer'), 'members:remove', { target: { userId: 'u', role: 'viewer' } })).toBe(false);
  });
});

describe('inviting', () => {
  it('cannot invite above your own role', () => {
    expect(authorize(as('admin'), 'members:invite', { newRole: 'owner' })).toEqual({
      allow: false,
      reason: 'cannot_grant_above_self',
    });
    expect(can(as('admin'), 'members:invite', { newRole: 'admin' })).toBe(true);
    expect(can(as('owner'), 'members:invite', { newRole: 'owner' })).toBe(true);
  });
});

describe('changing roles and removing people', () => {
  const t = (role: Role, userId = 'them') => ({ userId, role });

  it('nobody changes their own role', () => {
    for (const r of ['admin', 'owner'] as Role[]) {
      expect(authorize(as(r), 'members:change_role', { target: t(r, 'me'), newRole: 'viewer' })).toEqual({
        allow: false,
        reason: 'self_change',
      });
    }
  });
  it('admins manage only people below them', () => {
    expect(can(as('admin'), 'members:change_role', { target: t('staff'), newRole: 'admin' })).toBe(true);
    expect(authorize(as('admin'), 'members:change_role', { target: t('admin'), newRole: 'viewer' })).toEqual({
      allow: false,
      reason: 'not_above_target',
    });
    expect(authorize(as('admin'), 'members:change_role', { target: t('owner'), newRole: 'viewer' })).toEqual({
      allow: false,
      reason: 'not_above_target',
    });
    expect(authorize(as('admin'), 'members:remove', { target: t('admin') })).toEqual({
      allow: false,
      reason: 'not_above_target',
    });
    expect(can(as('admin'), 'members:remove', { target: t('staff') })).toBe(true);
  });
  it('admins cannot promote anyone to owner', () => {
    expect(authorize(as('admin'), 'members:change_role', { target: t('staff'), newRole: 'owner' })).toEqual({
      allow: false,
      reason: 'cannot_grant_above_self',
    });
  });
  it('owners can manage other owners', () => {
    expect(can(as('owner'), 'members:change_role', { target: t('owner'), newRole: 'admin' })).toBe(true);
    expect(can(as('owner'), 'members:remove', { target: t('owner') })).toBe(true);
  });
  it('removing yourself goes through leave, not remove', () => {
    expect(authorize(as('owner'), 'members:remove', { target: { userId: 'me', role: 'owner' } })).toEqual({
      allow: false,
      reason: 'self_change',
    });
  });
});

describe('leaving', () => {
  it('anyone below owner can leave', () => {
    for (const r of ['viewer', 'staff', 'admin'] as Role[]) {
      expect(can(as(r), 'members:leave')).toBe(true);
    }
  });
  it('the last owner cannot leave', () => {
    expect(authorize(as('owner'), 'members:leave', { ownerCount: 1 })).toEqual({ allow: false, reason: 'last_owner' });
    expect(can(as('owner'), 'members:leave', { ownerCount: 2 })).toBe(true);
  });
});

describe('transferring ownership', () => {
  it('only an owner, and not to themselves', () => {
    expect(can(as('owner'), 'org:transfer_ownership', { target: { userId: 'them', role: 'admin' } })).toBe(true);
    expect(authorize(as('owner'), 'org:transfer_ownership', { target: { userId: 'me', role: 'owner' } })).toEqual({
      allow: false,
      reason: 'self_change',
    });
    expect(can(as('admin'), 'org:transfer_ownership', { target: { userId: 'them', role: 'staff' } })).toBe(false);
  });
});

describe('ranks', () => {
  it('are strictly ordered', () => {
    expect(ROLES.map(rank)).toEqual([0, 1, 2, 3]);
  });
});

describe('members:rename', () => {
  const org = 'org-1';
  const actorOf = (role: Role) => ({ userId: 'me', orgId: org, role });
  const target = (role: Role, userId = 'them') => ({ orgId: org, target: { userId, role } });

  it('an admin may rename staff and viewers, not peers or owners', () => {
    expect(can(actorOf('admin'), 'members:rename', target('staff'))).toBe(true);
    expect(can(actorOf('admin'), 'members:rename', target('viewer'))).toBe(true);
    expect(can(actorOf('admin'), 'members:rename', target('admin'))).toBe(false);
    expect(can(actorOf('admin'), 'members:rename', target('owner'))).toBe(false);
  });

  it('an owner may rename anyone else but not themselves', () => {
    expect(can(actorOf('owner'), 'members:rename', target('admin'))).toBe(true);
    expect(can(actorOf('owner'), 'members:rename', target('owner'))).toBe(true);
    expect(can(actorOf('owner'), 'members:rename', target('owner', 'me'))).toBe(false);
  });

  it('staff and viewers may not rename anyone', () => {
    expect(can(actorOf('staff'), 'members:rename', target('viewer'))).toBe(false);
    expect(can(actorOf('viewer'), 'members:rename', target('viewer'))).toBe(false);
  });

  it('is refused in an archived camp and needs a target', () => {
    expect(can({ ...actorOf('owner'), archived: true }, 'members:rename', target('staff'))).toBe(false);
    expect(authorize(actorOf('admin'), 'members:rename', { orgId: org })).toEqual({
      allow: false,
      reason: 'missing_context',
    });
  });
});
