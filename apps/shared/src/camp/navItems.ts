import type { Action, Role } from '@buxa/domain';
import { ROUTES, type RoutePath } from '../config/routes';
import { roleAllows } from './abilities';

export interface NavItem {
  href: RoutePath;
  label: string;
  icon: string;
  /** Highlight for this address only, not for pages beneath it. */
  exact?: boolean;
  /**
   * Shown only to roles granted this action. Absent: shown to everyone, including someone with no camp yet.
   * Work and Admin items have no permission model yet, so they are absent here: access control for them is not built yet.
   */
  requires?: Action;
  /** Roles that never see this item, whatever else they are granted (a teacher's sidebar is its own short list). */
  hiddenFor?: readonly Role[];
  /** Shown only to these roles, whatever else they are granted. Absent: no role limit. */
  onlyFor?: readonly Role[];
  /** The item is a child of the item at this address: the sidebar shows it indented, just below its parent. */
  under?: RoutePath;
}

export interface NavGroup {
  /** The heading above the group. Empty for the group that holds Home. */
  label: string;
  items: readonly NavItem[];
  /** Roles that never see the whole group. */
  hiddenFor?: readonly Role[];
}

/** A teacher sees its own class screens only: no people list, no camp-wide log, no work, no admin. */
const TEACHER_HIDDEN: readonly Role[] = ['teacher'];

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
    label: 'Operations',
    items: [
      // The Sessions entry is the list of sessions (a date range each, holding classes). Its address stays /camp/sessions.
      { href: ROUTES.sessions, label: 'Sessions', icon: 'calendar', requires: 'events:read' },
      { href: ROUTES.myClasses, label: 'My classes', icon: 'calendar', onlyFor: ['teacher'] },
      { href: ROUTES.registration, label: 'Registration', icon: 'list', requires: 'registration:read' },
      { href: ROUTES.checkIn, label: 'Check-in', icon: 'check', requires: 'attendance:record' },
      { href: ROUTES.onSite, label: 'On site', icon: 'clock', requires: 'attendance:read' },
      {
        href: ROUTES.attendance,
        label: 'Attendance',
        icon: 'clipboard-check',
        requires: 'attendance:read',
        hiddenFor: TEACHER_HIDDEN,
      },
    ],
  },
  {
    label: 'Work',
    hiddenFor: TEACHER_HIDDEN,
    items: [
      { href: ROUTES.tasks, label: 'My tasks', icon: 'tasks' },
      { href: ROUTES.projects, label: 'Projects', icon: 'folder' },
      { href: ROUTES.boards, label: 'Boards', icon: 'kanban', under: ROUTES.projects },
      { href: ROUTES.calendar, label: 'Calendar', icon: 'calendar', under: ROUTES.projects },
      { href: ROUTES.agents, label: 'Agents', icon: 'agent' },
    ],
  },
  {
    label: 'Admin',
    hiddenFor: TEACHER_HIDDEN,
    items: [
      { href: ROUTES.people, label: 'People', icon: 'users', requires: 'people:read', hiddenFor: TEACHER_HIDDEN },
      { href: ROUTES.members, label: 'Team access', icon: 'user', requires: 'members:read' },
    ],
  },
];

/** Every item in the sidebar, in order. */
export const CAMP_NAV: readonly NavItem[] = CAMP_NAV_GROUPS.flatMap(group => group.items);

/** The items a person may see. `null` means they have no camp yet, so only items that need no permission remain. */
export const navFor = (role: Role | null, items: readonly NavItem[] = CAMP_NAV): readonly NavItem[] =>
  items.filter(
    item =>
      (!item.requires || (role !== null && roleAllows(role, item.requires))) &&
      !(role !== null && item.hiddenFor?.includes(role)) &&
      (!item.onlyFor || (role !== null && item.onlyFor.includes(role))),
  );

/** The groups a person may see, with the items they may see. A group with nothing visible is dropped. */
export const navGroupsFor = (role: Role | null, groups: readonly NavGroup[] = CAMP_NAV_GROUPS): readonly NavGroup[] =>
  groups
    .filter(group => !(role !== null && group.hiddenFor?.includes(role)))
    .map(group => ({ label: group.label, items: navFor(role, group.items) }))
    .filter(group => group.items.length > 0);

export const isActive = (pathname: string, item: Pick<NavItem, 'href' | 'exact'>): boolean =>
  pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
