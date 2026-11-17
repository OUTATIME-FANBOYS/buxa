import type { Action, Role } from '@buxa/domain';
import { ROUTES, type RoutePath } from '../../../config/routes';
import { roleAllows } from './abilities';

export interface NavItem {
  href: RoutePath;
  label: string;
  icon: string;
  /** Highlight for this address only, not for pages beneath it. */
  exact?: boolean;
  /**
   * Shown only to roles granted this action. Absent: shown to everyone, including someone with no camp yet.
   * Work and Admin items have no permission model yet, so they are absent here: access control for them is a later phase.
   */
  requires?: Action;
}

export interface NavGroup {
  /** The heading above the group. Empty for the group that holds Home. */
  label: string;
  items: readonly NavItem[];
}

/** The one sidebar, defined once. Groups appear in this order, and so do their items. */
export const CAMP_NAV_GROUPS: readonly NavGroup[] = [
  {
    label: '',
    items: [
      // Home has no `requires`: the camp part of it only appears with a camp, and the task part is for everyone.
      { href: ROUTES.camp, label: 'Home', icon: 'dashboard', exact: true },
    ],
  },
  {
    label: 'Camp operations',
    items: [
      { href: ROUTES.checkIn, label: 'Check-in', icon: 'check', requires: 'attendance:record' },
      { href: ROUTES.onSite, label: 'On site', icon: 'clock', requires: 'attendance:read' },
      { href: ROUTES.people, label: 'People', icon: 'users', requires: 'people:read' },
      { href: ROUTES.attendance, label: 'Attendance', icon: 'list', requires: 'attendance:read' },
    ],
  },
  {
    label: 'Work',
    items: [
      { href: ROUTES.tasks, label: 'My tasks', icon: 'tasks' },
      { href: ROUTES.projects, label: 'Projects', icon: 'folder' },
      { href: ROUTES.boards, label: 'Boards', icon: 'kanban' },
      { href: ROUTES.classes, label: 'Classes', icon: 'calendar', requires: 'events:read' },
      { href: ROUTES.calendar, label: 'Calendar', icon: 'calendar' },
      { href: ROUTES.agents, label: 'Agents', icon: 'agent' },
      { href: ROUTES.reports, label: 'Reports', icon: 'chart' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: ROUTES.members, label: 'Team access', icon: 'user', requires: 'members:read' },
      { href: ROUTES.settings, label: 'Settings', icon: 'settings' },
      // Help has no `requires`: anyone may read it.
      { href: ROUTES.help, label: 'Help', icon: 'help' },
    ],
  },
];

/** Every item in the sidebar, in order. */
export const CAMP_NAV: readonly NavItem[] = CAMP_NAV_GROUPS.flatMap(group => group.items);

/** The items a person may see. `null` means they have no camp yet, so only items that need no permission remain. */
export const navFor = (role: Role | null, items: readonly NavItem[] = CAMP_NAV): readonly NavItem[] =>
  items.filter(item => !item.requires || (role !== null && roleAllows(role, item.requires)));

/** The groups a person may see, with the items they may see. A group with nothing visible is dropped. */
export const navGroupsFor = (role: Role | null, groups: readonly NavGroup[] = CAMP_NAV_GROUPS): readonly NavGroup[] =>
  groups.map(group => ({ label: group.label, items: navFor(role, group.items) })).filter(group => group.items.length > 0);

export const isActive = (pathname: string, item: Pick<NavItem, 'href' | 'exact'>): boolean =>
  pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
