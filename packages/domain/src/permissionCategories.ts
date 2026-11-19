import { GRANTS, type Action, type Role } from './permissions';

/**
 * The areas a camp's permissions are grouped into, so each can be checked on its own.
 * Grouping only: it does not change what any role is granted (that is `GRANTS` in `permissions.ts`).
 */
export const PERMISSION_CATEGORIES = [
  'Operations',
  'People',
  'Classes and events',
  'Money',
  'Registration',
  'Team',
  'Work',
  'Admin',
] as const;
export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number];

/** Every action sits in exactly one category. The type forces a key for each category; the test checks each action once. */
export const CATEGORY_PERMISSIONS = {
  Operations: ['attendance:read', 'attendance:record', 'attendance:override', 'attendance:export'],
  People: [
    'people:read',
    'people:read_contact',
    'people:create',
    'people:update',
    'people:delete',
    'people:authorise_pickup',
    'memberships:manage',
    'credentials:manage',
  ],
  'Classes and events': ['classes:manage', 'events:read', 'events:create', 'events:update', 'events:delete'],
  Money: [],
  Registration: [],
  Team: [
    'members:read',
    'members:leave',
    'members:read_contact',
    'members:invite',
    'members:change_role',
    'members:remove',
    // Not in the spec table; grouped with the team it renames members of. See docs/phases/03-registration.md.
    'members:rename',
  ],
  Work: [
    'tasks:read',
    'tasks:create',
    'tasks:update',
    'tasks:move',
    'tasks:comment',
    'tasks:delete',
    'tasks:manage_board',
  ],
  Admin: [
    'org:read',
    'org:update',
    'audit:read',
    'org:delete',
    'org:transfer_ownership',
    'data:export',
    'data:erase',
    // Not in the spec table; the spec says there is no archive action. See docs/phases/03-registration.md.
    'org:archive',
    'org:unarchive',
  ],
} as const satisfies Record<PermissionCategory, readonly Action[]>;

/** How much of a category a role holds: every action, some, or none. */
export type Coverage = 'all' | 'some' | 'none';

export function coverage(role: Role, category: PermissionCategory): Coverage {
  const actions: readonly Action[] = CATEGORY_PERMISSIONS[category];
  if (actions.length === 0) {
    return 'none';
  }
  const held = actions.filter(action => GRANTS[role].has(action)).length;
  if (held === actions.length) {
    return 'all';
  }

  return held === 0 ? 'none' : 'some';
}
