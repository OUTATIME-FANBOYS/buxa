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
  /** Hidden in the teaching view (a viewer whose person is an instructor), whatever else it is granted. */
  hiddenWhenTeaching?: boolean;
  /** Shown only in the teaching view. */
  teachingOnly?: boolean;
  /** The item is a child of the item at this address: the sidebar shows it indented, just below its parent. */
  under?: RoutePath;
}

export interface NavGroup {
  /** The heading above the group. Empty for the group that holds Home. */
  label: string;
  items: readonly NavItem[];
  /** Hidden in the teaching view, which sees its own class screens only. */
  hiddenWhenTeaching?: boolean;
}

/** Who is looking at the sidebar: their access level, and whether they are in the teaching view (an instructor with viewer access). */
export interface NavViewer {
  role: Role;
  teaching?: boolean;
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
    label: 'Operations',
    items: [
      // The Sessions entry is the list of sessions (a date range each, holding classes). Its address stays /camp/sessions.
      { href: ROUTES.sessions, label: 'Sessions', icon: 'calendar', requires: 'events:read' },
      { href: ROUTES.myClasses, label: 'My classes', icon: 'calendar-days', teachingOnly: true },
      {
        href: ROUTES.registration,
        label: 'Registration',
        icon: 'list',
        requires: 'registration:read',
        under: ROUTES.sessions,
      },
      { href: ROUTES.holds, label: 'Holds', icon: 'hourglass', requires: 'registration:read', under: ROUTES.sessions },
      { href: ROUTES.checkIn, label: 'Check-in', icon: 'check', requires: 'attendance:record' },
      { href: ROUTES.onSite, label: 'On site', icon: 'map-pin', requires: 'attendance:read' },
      {
        href: ROUTES.attendance,
        label: 'Attendance',
        icon: 'clipboard-check',
        requires: 'attendance:read',
        hiddenWhenTeaching: true,
      },
    ],
  },
  {
    label: 'Work',
    hiddenWhenTeaching: true,
    items: [
      { href: ROUTES.tasks, label: 'My tasks', icon: 'tasks' },
      { href: ROUTES.projects, label: 'Projects', icon: 'folder' },
      { href: ROUTES.boards, label: 'Boards', icon: 'kanban', under: ROUTES.projects },
      { href: ROUTES.calendar, label: 'Calendar', icon: 'calendar-clock', under: ROUTES.projects },
      { href: ROUTES.agents, label: 'Agents', icon: 'agent' },
    ],
  },
  {
    label: 'Admin',
    hiddenWhenTeaching: true,
    items: [
      { href: ROUTES.people, label: 'People', icon: 'users', requires: 'people:read', hiddenWhenTeaching: true },
      { href: ROUTES.members, label: 'Team access', icon: 'user', requires: 'members:read' },
      { href: ROUTES.reports, label: 'Reports', icon: 'chart', requires: 'audit:read' },
    ],
  },
];

/** Every item in the sidebar, in order. */
export const CAMP_NAV: readonly NavItem[] = CAMP_NAV_GROUPS.flatMap(group => group.items);

/** The items a person may see. `null` means they have no camp yet, so only items that need no permission remain. */
export const navFor = (viewer: NavViewer | null, items: readonly NavItem[] = CAMP_NAV): readonly NavItem[] =>
  items.filter(item => {
    if (viewer === null) {
      return !item.requires && !item.teachingOnly;
    }
    const teaching = viewer.teaching === true;

    return (
      (!item.requires || roleAllows(viewer.role, item.requires, teaching)) &&
      !(teaching && item.hiddenWhenTeaching === true) &&
      (!item.teachingOnly || teaching)
    );
  });

/** The groups a person may see, with the items they may see. A group with nothing visible is dropped. */
export const navGroupsFor = (
  viewer: NavViewer | null,
  groups: readonly NavGroup[] = CAMP_NAV_GROUPS,
): readonly NavGroup[] =>
  groups
    .filter(group => !(viewer?.teaching === true && group.hiddenWhenTeaching === true))
    .map(group => ({ label: group.label, items: navFor(viewer, group.items) }))
    .filter(group => group.items.length > 0);

export const isActive = (pathname: string, item: Pick<NavItem, 'href' | 'exact'>): boolean =>
  pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
