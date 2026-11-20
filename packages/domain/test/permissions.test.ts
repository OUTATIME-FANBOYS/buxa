import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  GRANTS,
  OPTION_ACTION,
  ROLES,
  authorize,
  can,
  rank,
  type Action,
  type Actor,
  type Role,
} from '../src';

const ORG = 'org-1';
const as = (role: Role, userId = 'me'): Actor => ({ userId, orgId: ORG, role });

// The matrix, written out so a reviewer can read it. Y = allowed, . = denied.
//                          viewer staff admin owner teacher
const MATRIX: Record<Action, string> = {
  'org:read': 'YYYYY',
  'org:update': '..YY.',
  'org:archive': '..YY.',
  'org:delete': '...Y.',
  'org:unarchive': '..YY.',
  'org:transfer_ownership': '...Y.',
  'members:read': 'YYYY.',
  'members:read_contact': '..YY.',
  'members:invite': '..YY.',
  'members:change_role': '..YY.',
  'members:set_options': '..YY.',
  'members:remove': '..YY.',
  'members:rename': '..YY.',
  'members:leave': 'YYYYY',
  'audit:read': '..YY.',
  'data:export': '..YY.',
  'data:erase': '...Y.',
  'people:read': 'YYYYY',
  'people:read_contact': '.YYY.',
  'people:create': '.YYY.',
  'people:update': '.YYY.',
  'people:delete': '..YY.',
  'people:authorise_pickup': '..YY.',
  'memberships:manage': '..YY.',
  'credentials:manage': '..YY.',
  'attendance:read': '.YYYY',
  'attendance:record': '.YYY.',
  'attendance:override': '..YY.',
  'attendance:export': '..YY.',
  'events:read': 'YYYYY',
  'events:create': '.YYY.',
  'events:update': '.YYY.',
  'events:update_details': '..YYY',
  'events:delete': '.YYY.',
  'classes:manage': '.YYY.',
  'tasks:read': 'YYYY.',
  'tasks:create': '.YYY.',
  'tasks:update': '.YYY.',
  'tasks:move': '.YYY.',
  'tasks:comment': '.YYY.',
  'tasks:delete': '..YY.',
  'tasks:manage_board': '..YY.',
  'holds:manage': '.YYY.',
  'registration:read': '.YYY.',
  'registration:submit': '.YYY.',
  'registration:manage': '..YY.',
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

  it('a higher role never has fewer grants than a lower one (the ladder; teacher is outside it)', () => {
    const ladder = ROLES.filter(r => r !== 'teacher');
    for (let i = 1; i < ladder.length; i++) {
      for (const a of GRANTS[ladder[i - 1]]) {
        expect(GRANTS[ladder[i]].has(a)).toBe(true);
      }
    }
  });
});

describe('teacher: assigned classes only', () => {
  const T = 'teacher' as const;
  const scoped: Action[] = ['events:read', 'events:update_details', 'people:read', 'attendance:read'];

  it('is refused the scoped actions unless the class is one it is assigned to', () => {
    for (const a of scoped) {
      expect(authorize(as(T), a, { orgId: ORG })).toEqual({ allow: false, reason: 'not_assigned' });
      expect(authorize(as(T), a, { orgId: ORG, assignedToClass: false })).toEqual({
        allow: false,
        reason: 'not_assigned',
      });
      expect(authorize(as(T), a, { orgId: ORG, assignedToClass: true })).toEqual({ allow: true });
    }
  });

  it('is allowed on its own classes, and the scope does not change any other role', () => {
    expect(can(as(T), 'attendance:read', { orgId: ORG, assignedToClass: true })).toBe(true);
    // Check-in is off for a teacher by default; an admin turns it on per person (not part of the role).
    expect(authorize(as(T), 'attendance:record', { orgId: ORG, assignedToClass: true })).toEqual({
      allow: false,
      reason: 'role_not_allowed',
    });
    expect(can(as('viewer'), 'attendance:read')).toBe(false);
    expect(can(as('staff'), 'attendance:record')).toBe(true);
    expect(can(as('staff'), 'people:read')).toBe(true);
  });

  it('is refused contact details, edits, team, admin and money rights even in its own classes', () => {
    const own = { orgId: ORG, assignedToClass: true };
    const denied: Action[] = [
      'people:read_contact',
      'people:create',
      'people:update',
      'people:delete',
      'classes:manage',
      'events:create',
      'events:delete',
      'attendance:override',
      'attendance:export',
      'members:read',
      'members:read_contact',
      'members:invite',
      'members:change_role',
      'members:remove',
      'audit:read',
      'org:update',
      'org:delete',
      'tasks:read',
      'tasks:create',
    ];
    for (const a of denied) {
      expect(can(as(T), a, own), a).toBe(false);
    }
  });

  it('is refused events:update (the whole class) and may change only the class details', () => {
    expect(authorize(as(T), 'events:update', { orgId: ORG, assignedToClass: true })).toEqual({
      allow: false,
      reason: 'role_not_allowed',
    });
    expect(can(as(T), 'events:update_details', { orgId: ORG, assignedToClass: true })).toBe(true);
    expect(can(as(T), 'events:update_details', { orgId: ORG })).toBe(false);
  });

  it('is refused in another organisation even when assigned', () => {
    expect(authorize(as(T), 'attendance:read', { orgId: 'org-2', assignedToClass: true })).toEqual({
      allow: false,
      reason: 'other_org',
    });
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
  it('are strictly ordered on the ladder, and teacher sits at the bottom with viewer', () => {
    expect(['viewer', 'staff', 'admin', 'owner'].map(r => rank(r as Role))).toEqual([0, 1, 2, 3]);
    expect(rank('teacher')).toBe(rank('viewer'));
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

describe('member options: check-in and check-out for a teacher', () => {
  const T = 'teacher' as const;
  const on = (role: Role, options?: Actor['options'], userId = 'me'): Actor => ({ userId, orgId: ORG, role, options });
  const assigned = { orgId: ORG, assignedToClass: true };

  it('the option is refused without the flag, so check-in stays off by default', () => {
    expect(authorize(on(T), 'attendance:record', assigned)).toEqual({ allow: false, reason: 'role_not_allowed' });
    expect(authorize(on(T, []), 'attendance:record', assigned)).toEqual({ allow: false, reason: 'role_not_allowed' });
  });

  it('with the flag, a teacher may record attendance in its assigned classes only', () => {
    const flagged = on(T, ['teacher.check_in_out']);
    expect(authorize(flagged, 'attendance:record', assigned)).toEqual({ allow: true });
    expect(authorize(flagged, 'attendance:record', { orgId: ORG })).toEqual({ allow: false, reason: 'not_assigned' });
    expect(authorize(flagged, 'attendance:record', { orgId: ORG, assignedToClass: false })).toEqual({
      allow: false,
      reason: 'not_assigned',
    });
  });

  it('the option grants only the action it names, not the other actions of the teacher', () => {
    const flagged = on(T, ['teacher.check_in_out']);
    expect(can(flagged, 'attendance:override', assigned)).toBe(false);
    expect(can(flagged, 'attendance:export', assigned)).toBe(false);
    expect(can(flagged, 'people:read_contact', assigned)).toBe(false);
    expect(can(flagged, 'events:update', assigned)).toBe(false);
  });

  it('is refused for every other role, which keeps its own grants and nothing more', () => {
    for (const role of ['viewer', 'staff', 'admin', 'owner'] as const) {
      const flagged = on(role, ['teacher.check_in_out']);
      const expected = GRANTS[role].has('attendance:record');
      expect(can(flagged, 'attendance:record', assigned), role).toBe(expected);
      expect(can(flagged, 'attendance:override', assigned), role).toBe(GRANTS[role].has('attendance:override'));
    }
    expect(can(on('viewer', ['teacher.check_in_out']), 'attendance:record', assigned)).toBe(false);
  });

  it('every option names an action that exists', () => {
    for (const action of Object.values(OPTION_ACTION)) {
      expect(ACTIONS).toContain(action);
    }
  });
});

describe('members:set_options', () => {
  const target = (role: Role, userId = 'them') => ({ userId, role });
  const set = (actor: Actor, t: { userId: string; role: Role }) =>
    authorize(actor, 'members:set_options', { orgId: ORG, target: t, option: 'teacher.check_in_out' });

  it('an admin or owner may set an option on a teacher', () => {
    expect(set(as('admin', 'a'), target('teacher'))).toEqual({ allow: true });
    expect(set(as('owner', 'o'), target('teacher'))).toEqual({ allow: true });
  });

  it('staff, viewers and teachers may not set options', () => {
    expect(set(as('staff', 's'), target('teacher'))).toEqual({ allow: false, reason: 'role_not_allowed' });
    expect(set(as('viewer', 'v'), target('teacher'))).toEqual({ allow: false, reason: 'role_not_allowed' });
    expect(set(as('teacher', 't'), target('teacher'))).toEqual({ allow: false, reason: 'role_not_allowed' });
  });

  it('an option can be set only on a teacher', () => {
    expect(set(as('admin', 'a'), target('staff'))).toEqual({ allow: false, reason: 'option_not_for_role' });
    expect(set(as('owner', 'o'), target('viewer'))).toEqual({ allow: false, reason: 'option_not_for_role' });
  });

  it('an admin may not set an option on itself, and a write needs a target and an option', () => {
    expect(set(as('admin', 'a'), target('teacher', 'a'))).toEqual({ allow: false, reason: 'self_change' });
    expect(authorize(as('admin', 'a'), 'members:set_options', { orgId: ORG, target: target('teacher') })).toEqual({
      allow: false,
      reason: 'missing_context',
    });
  });

  it('is refused in an archived camp', () => {
    expect(
      authorize({ ...as('admin', 'a'), archived: true }, 'members:set_options', {
        orgId: ORG,
        target: target('teacher'),
        option: 'teacher.check_in_out',
      }),
    ).toEqual({ allow: false, reason: 'archived_camp' });
  });
});
