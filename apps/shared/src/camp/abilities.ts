import { grantsOf, ORG_ACCESS, type Action, type Role } from '@buxa/domain';
import type { RoleTone } from '../tones';

/** The label of each organization access level, from the role table in @buxa/domain (docs/ROLES.md). */
export const ROLE_LABEL: Readonly<Record<Role, string>> = Object.fromEntries(
  ORG_ACCESS.map(role => [role.key, role.label]),
) as Record<Role, string>;

/** The pill colour for each access level: owner violet, admin teal, staff lime, viewer blue. */
export const ROLE_TONE: Readonly<Record<Role, RoleTone>> = {
  owner: 'role-owner',
  admin: 'role-admin',
  staff: 'role-staff',
  viewer: 'role-viewer',
};

/** The abilities worth showing a person, in plain words. */
const ABILITIES: readonly { action: Action; label: string }[] = [
  { action: 'members:read', label: 'See who is in the camp' },
  { action: 'people:create', label: 'Add and edit people' },
  { action: 'attendance:record', label: 'Record attendance' },
  { action: 'tasks:create', label: 'Create and move staff tasks' },
  { action: 'org:update', label: 'Rename the camp' },
  { action: 'members:invite', label: 'Invite people to the camp' },
  { action: 'audit:read', label: 'Read the audit log' },
  { action: 'org:delete', label: 'Delete the camp' },
];

/**
 * What this access level is granted, from the same table the server checks. `teaching` is the teaching view (a viewer whose person is
 * an instructor). Per-request rules (like not granting above your own role, or the assigned-classes scope) are not shown here.
 */
export const abilitiesFor = (role: Role, teaching = false): { label: string; allowed: boolean }[] =>
  ABILITIES.map(({ action, label }) => ({ label, allowed: grantsOf({ role, instructor: teaching }).has(action) }));

/** Whether an access level is granted an action, for deciding what to show. The server still decides what is allowed. */
export const roleAllows = (role: Role, action: Action, teaching = false): boolean =>
  grantsOf({ role, instructor: teaching }).has(action);
