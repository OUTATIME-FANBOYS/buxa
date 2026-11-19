import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  CATEGORY_PERMISSIONS,
  GRANTS,
  PERMISSION_CATEGORIES,
  coverage,
  type Action,
  type PermissionCategory,
  type Role,
} from '../src';

const grouped = Object.values(CATEGORY_PERMISSIONS).flat();

describe('permission categories: grouping', () => {
  it('every permission is in exactly one category', () => {
    for (const action of ACTIONS) {
      const count = grouped.filter(a => a === action).length;
      expect(count, action).toBe(1);
    }
  });

  it('no category lists a permission that does not exist', () => {
    const known = new Set<string>(ACTIONS);
    for (const action of grouped) {
      expect(known.has(action), action).toBe(true);
    }
  });

  it('has a group for every category name, and no other groups', () => {
    expect(Object.keys(CATEGORY_PERMISSIONS).sort()).toEqual([...PERMISSION_CATEGORIES].sort());
  });
});

// The spec table in docs/phases/03-registration.md, per category. Roles are cumulative:
// staff has what viewer has, admin what staff has, owner what admin has (the spec's own rule).
// members:rename and org:archive / org:unarchive are not in the spec table; they are listed here
// as the code grants them, and the spec doc records them as mismatches.
const SPEC: Record<PermissionCategory, Record<Role, Action[]>> = {
  Operations: {
    viewer: [],
    staff: ['attendance:read', 'attendance:record'],
    admin: ['attendance:read', 'attendance:record', 'attendance:override', 'attendance:export'],
    owner: ['attendance:read', 'attendance:record', 'attendance:override', 'attendance:export'],
  },
  People: {
    viewer: ['people:read'],
    staff: ['people:read', 'people:read_contact', 'people:create', 'people:update'],
    admin: [
      'people:read',
      'people:read_contact',
      'people:create',
      'people:update',
      'people:delete',
      'people:authorise_pickup',
      'memberships:manage',
      'credentials:manage',
    ],
    owner: [
      'people:read',
      'people:read_contact',
      'people:create',
      'people:update',
      'people:delete',
      'people:authorise_pickup',
      'memberships:manage',
      'credentials:manage',
    ],
  },
  'Classes and events': {
    viewer: ['events:read'],
    staff: ['events:read', 'classes:manage'],
    admin: ['events:read', 'classes:manage', 'events:create', 'events:update', 'events:delete'],
    owner: ['events:read', 'classes:manage', 'events:create', 'events:update', 'events:delete'],
  },
  Money: { viewer: [], staff: [], admin: [], owner: [] },
  Registration: { viewer: [], staff: [], admin: [], owner: [] },
  Team: {
    viewer: ['members:read', 'members:leave'],
    staff: ['members:read', 'members:leave'],
    admin: [
      'members:read',
      'members:leave',
      'members:read_contact',
      'members:invite',
      'members:change_role',
      'members:remove',
      'members:rename',
    ],
    owner: [
      'members:read',
      'members:leave',
      'members:read_contact',
      'members:invite',
      'members:change_role',
      'members:remove',
      'members:rename',
    ],
  },
  Work: {
    viewer: ['tasks:read'],
    staff: ['tasks:read', 'tasks:create', 'tasks:update', 'tasks:move', 'tasks:comment'],
    admin: [
      'tasks:read',
      'tasks:create',
      'tasks:update',
      'tasks:move',
      'tasks:comment',
      'tasks:delete',
      'tasks:manage_board',
    ],
    owner: [
      'tasks:read',
      'tasks:create',
      'tasks:update',
      'tasks:move',
      'tasks:comment',
      'tasks:delete',
      'tasks:manage_board',
    ],
  },
  Admin: {
    viewer: ['org:read'],
    staff: ['org:read'],
    admin: ['org:read', 'org:update', 'audit:read'],
    owner: [
      'org:read',
      'org:update',
      'audit:read',
      'org:delete',
      'org:transfer_ownership',
      'data:export',
      'data:erase',
      'org:archive',
      'org:unarchive',
    ],
  },
};

const ROLE_ORDER: Role[] = ['viewer', 'staff', 'admin', 'owner'];

describe('permission categories: default role grants match the spec table', () => {
  for (const category of PERMISSION_CATEGORIES) {
    for (const role of ROLE_ORDER) {
      it(`${category} / ${role}`, () => {
        const held = CATEGORY_PERMISSIONS[category].filter(action => GRANTS[role].has(action)).sort();
        expect(held).toEqual([...SPEC[category][role]].sort());
      });
    }
  }

  it('owner holds every permission in every category', () => {
    for (const category of PERMISSION_CATEGORIES) {
      expect(coverage('owner', category), category).toBe(CATEGORY_PERMISSIONS[category].length === 0 ? 'none' : 'all');
    }
  });

  it('coverage reports all, some or none from the same grants', () => {
    expect(coverage('viewer', 'Operations')).toBe('none');
    expect(coverage('staff', 'Operations')).toBe('some');
    expect(coverage('admin', 'Operations')).toBe('all');
    expect(coverage('staff', 'Money')).toBe('none');
  });
});
