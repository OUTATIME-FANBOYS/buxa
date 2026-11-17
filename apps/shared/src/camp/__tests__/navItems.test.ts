import { describe, expect, it } from 'vitest';
import { ROLES } from '@buxa/domain';
import { ROUTES } from '@buxa/shared/config/routes';
import { CAMP_NAV, CAMP_NAV_GROUPS, isActive, navFor, navGroupsFor, type NavGroup } from '../navItems';

const hrefs = (role: Parameters<typeof navFor>[0]) => navFor(role).map(item => item.href);
const groupLabels = (groups: readonly NavGroup[]) => groups.map(group => group.label);

describe('the sidebar groups', () => {
  it('puts Home first, then operations, work and admin, in that order', () => {
    expect(groupLabels(CAMP_NAV_GROUPS)).toEqual(['', 'Operations', 'Work', 'Admin']);
  });

  it('lists the items of each group in order', () => {
    expect(CAMP_NAV_GROUPS.map(group => group.items.map(item => item.label))).toEqual([
      ['Home'],
      ['Check-in', 'On site', 'People', 'Attendance', 'Classes', 'Help'],
      ['My tasks', 'Projects', 'Boards', 'Calendar', 'Agents', 'Reports'],
      ['Team access', 'Settings'],
    ]);
  });

  it('keeps every route in one place: the nav links only to known routes, and the old kanban address is gone', () => {
    const known: readonly string[] = Object.values(ROUTES);
    for (const item of CAMP_NAV) expect(known).toContain(item.href);
    expect(hrefs('owner')).not.toContain('/kanban');
  });

  it('gives Work and Admin items without a permission, and camp items the permission they had before', () => {
    const requires = Object.fromEntries(CAMP_NAV.map(item => [item.label, item.requires]));
    expect(requires).toMatchObject({
      'Check-in': 'attendance:record', 'On site': 'attendance:read', People: 'people:read', Attendance: 'attendance:read',
      Classes: 'events:read', 'Team access': 'members:read',
      Home: undefined, 'My tasks': undefined, Projects: undefined, Settings: undefined, Help: undefined,
    });
  });
});

describe('navFor', () => {
  it('shows every item to staff and above; a viewer sees no attendance items (check-in, on site, attendance)', () => {
    for (const role of ROLES.filter(r => r !== 'viewer')) expect(hrefs(role)).toEqual(CAMP_NAV.map(item => item.href));
    const attendance: string[] = [ROUTES.checkIn, ROUTES.onSite, ROUTES.attendance];
    expect(hrefs('viewer')).toEqual(CAMP_NAV.map(item => item.href).filter(h => !attendance.includes(h)));
  });

  it('shows only items needing no permission when there is no camp yet', () => {
    expect(hrefs(null)).toEqual([ROUTES.camp, ROUTES.help, ROUTES.tasks, ROUTES.projects, ROUTES.boards, ROUTES.calendar, ROUTES.agents, ROUTES.reports, ROUTES.settings]);
  });

  it('hides an item from a role that lacks its permission, and keeps the rest', () => {
    const items = [
      { href: ROUTES.people, label: 'People', icon: 'users', requires: 'people:read' },
      { href: ROUTES.settings, label: 'Settings', icon: 'settings' },
    ] as const;
    expect(navFor(null, items).map(i => i.label)).toEqual(['Settings']);
    expect(navFor('viewer', items).map(i => i.label)).toEqual(['People', 'Settings']);
  });

  it('works on any item list, so another layout can bring its own', () => {
    const own = [{ href: ROUTES.camp, label: 'Home', icon: 'home' }] as const;
    expect(navFor(null, own)).toEqual(own);
  });
});

describe('navGroupsFor', () => {
  it('keeps the group order and drops a group with nothing left to show', () => {
    expect(groupLabels(navGroupsFor(null))).toEqual(['', 'Operations', 'Work', 'Admin']);
    expect(groupLabels(navGroupsFor('owner'))).toEqual(['', 'Operations', 'Work', 'Admin']);
    const onlyPermitted = [
      { label: 'Gated', items: [{ href: ROUTES.people, label: 'People', icon: 'users', requires: 'people:read' }] },
      { label: 'Open', items: [{ href: ROUTES.settings, label: 'Settings', icon: 'settings' }] },
    ] as const satisfies readonly NavGroup[];
    expect(groupLabels(navGroupsFor(null, onlyPermitted))).toEqual(['Open']);
  });
});

describe('isActive', () => {
  const home = { href: ROUTES.camp, exact: true };
  const members = { href: ROUTES.members };

  it('matches an exact item only on its own address', () => {
    expect(isActive(ROUTES.camp, home)).toBe(true);
    expect(isActive(ROUTES.tasks, home)).toBe(false);
  });

  it('matches a non-exact item on its address and beneath it, not on a look-alike', () => {
    expect(isActive(ROUTES.members, members)).toBe(true);
    expect(isActive(`${ROUTES.members}/42`, members)).toBe(true);
    expect(isActive(`${ROUTES.members}ship`, members)).toBe(false);
  });
});
