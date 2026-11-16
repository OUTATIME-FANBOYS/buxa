import { GRANTS, type Action, type Role } from '@buxa/domain';

export const ROLE_LABEL: Readonly<Record<Role, string>> = { owner: 'Owner', admin: 'Admin', staff: 'Staff', viewer: 'Viewer' };

/** The abilities worth showing a person, in plain words. */
const ABILITIES: readonly { action: Action; label: string }[] = [
  { action: 'members:read', label: 'See who is in the camp' },
  { action: 'people:create', label: 'Add and edit people' },
  { action: 'attendance:record', label: 'Record attendance' },
  { action: 'tasks:create', label: 'Create and move staff tasks' },
  { action: 'org:update', label: 'Rename the camp' },
  { action: 'members:invite', label: 'Manage who has access' },
  { action: 'audit:read', label: 'Read the audit log' },
  { action: 'org:delete', label: 'Delete the camp' },
];

/** What this role is granted, from the same table the server checks. Per-request rules (like not granting above your own role) are not shown here. */
export const abilitiesFor = (role: Role): { label: string; allowed: boolean }[] =>
  ABILITIES.map(({ action, label }) => ({ label, allowed: GRANTS[role].has(action) }));

/** Whether a role is granted an action, for deciding what to show. The server still decides what is allowed. */
export const roleAllows = (role: Role, action: Action): boolean => GRANTS[role].has(action);
