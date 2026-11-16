import type { Action, Role } from '@buxa/domain';
import { ROUTES, type RoutePath } from '@/config/routes';
import { roleAllows } from '../lib/abilities';

export interface NavItem {
  href: RoutePath;
  label: string;
  icon: string;
  /** Highlight for this address only, not for pages beneath it. */
  exact?: boolean;
  /** Shown only to roles granted this action. Absent: shown to everyone, including someone with no camp yet. */
  requires?: Action;
}

/** The camp area's navigation, defined once. */
export const CAMP_NAV: readonly NavItem[] = [
  { href: ROUTES.camp, label: 'Overview', icon: 'dashboard', exact: true, requires: 'org:read' },
  { href: ROUTES.checkIn, label: 'Check-in', icon: 'check', requires: 'attendance:record' },
  { href: ROUTES.onSite, label: 'On site', icon: 'clock', requires: 'attendance:read' },
  { href: ROUTES.people, label: 'People', icon: 'users', requires: 'people:read' },
  { href: ROUTES.attendance, label: 'Attendance', icon: 'list', requires: 'attendance:read' },
  { href: ROUTES.members, label: 'Team access', icon: 'user', requires: 'members:read' },
  { href: ROUTES.kanban, label: 'Staff board', icon: 'kanban' }, // the original kanban demo
];

/** The items a person may see. `null` means they have no camp yet, so only items that need no permission remain. */
export const navFor = (role: Role | null, items: readonly NavItem[] = CAMP_NAV): readonly NavItem[] =>
  items.filter(item => !item.requires || (role !== null && roleAllows(role, item.requires)));

export const isActive = (pathname: string, item: Pick<NavItem, 'href' | 'exact'>): boolean =>
  pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
