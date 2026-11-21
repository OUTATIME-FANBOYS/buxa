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

// The agreed default grant per category, written out per role (teacher is not on the viewer-to-owner ladder).
// Owner and admin have the same grants except the owner-only actions: transfer ownership, delete the camp and erase data.
// Extra options for teachers (such as check-in and check-out) are off by default and turned on per person by an admin.
const SPEC: Record<PermissionCategory, Record<Role, Action[]>> = {
  Operations: {
    viewer: [],
    staff: ['attendance:read', 'attendance:record'],
    admin: ['attendance:read', 'attendance:record', 'attendance:override', 'attendance:export'],
    owner: ['attendance:read', 'attendance:record', 'attendance:override', 'attendance:export'],
    teacher: ['attendance:read'],
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
    teacher: ['people:read'],
  },
  'Classes and events': {
    viewer: ['events:read'],
    staff: ['events:read', 'classes:manage', 'events:create', 'events:update', 'events:delete'],
    admin: [
      'events:read',
      'classes:manage',
      'events:create',
      'events:update',
      'events:update_details',
      'events:delete',
    ],
    owner: [
      'events:read',
      'classes:manage',
      'events:create',
      'events:update',
      'events:update_details',
      'events:delete',
    ],
    teacher: ['events:read', 'events:update_details'],
  },
  Money: { viewer: [], staff: [], admin: [], owner: [], teacher: [] },
  Registration: {
    viewer: [],
    staff: ['registration:read', 'registration:submit', 'registration:confirm', 'holds:manage'],
    admin: ['registration:read', 'registration:submit', 'registration:confirm', 'registration:manage', 'holds:manage'],
    owner: ['registration:read', 'registration:submit', 'registration:confirm', 'registration:manage', 'holds:manage'],
    teacher: [],
  },
  Team: {
    viewer: ['members:read', 'members:leave'],
    staff: ['members:read', 'members:leave', 'members:invite'],
    admin: [
      'members:read',
      'members:leave',
      'members:read_contact',
      'members:invite',
      'members:change_role',
      'members:set_options',
      'members:remove',
      'members:rename',
    ],
    owner: [
      'members:read',
      'members:leave',
      'members:read_contact',
      'members:invite',
      'members:change_role',
      'members:set_options',
      'members:remove',
      'members:rename',
    ],
    teacher: ['members:leave'],
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
    teacher: [],
  },
  Admin: {
    viewer: ['org:read'],
    staff: ['org:read'],
    admin: ['org:read', 'org:update', 'audit:read', 'org:archive', 'org:unarchive', 'data:export'],
    owner: [
      'org:read',
      'org:update',
      'audit:read',
      'org:archive',
      'org:unarchive',
      'data:export',
      'org:delete',
      'org:transfer_ownership',
      'data:erase',
    ],
    teacher: ['org:read'],
  },
};

const ROLE_ORDER: Role[] = ['viewer', 'staff', 'admin', 'owner', 'teacher'];

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
