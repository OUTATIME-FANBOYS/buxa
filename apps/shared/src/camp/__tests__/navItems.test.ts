import { describe, expect, it } from 'vitest';
import { ROLES } from '@buxa/domain';
import { ROUTES } from '../../config/routes';
import { CAMP_NAV, CAMP_NAV_GROUPS, isActive, navFor, navGroupsFor, type NavGroup } from '../navItems';
import { roleAllows } from '../abilities';

const hrefs = (role: Parameters<typeof navFor>[0]) => navFor(role).map(item => item.href);
const groupLabels = (groups: readonly NavGroup[]) => groups.map(group => group.label);

describe('the sidebar groups', () => {
  it('puts Home first, then operations, work and admin, in that order', () => {
    expect(groupLabels(CAMP_NAV_GROUPS)).toEqual(['', 'Operations', 'Work', 'Admin']);
  });

  it('lists the items of each group in order', () => {
    expect(CAMP_NAV_GROUPS.map(group => group.items.map(item => item.label))).toEqual([
      ['Home'],
      ['Sessions', 'My classes', 'Registration', 'Holds', 'Check-in', 'On site', 'Attendance'],
      ['My tasks', 'Projects', 'Boards', 'Calendar', 'Agents'],
      ['People', 'Team access', 'Reports'],
    ]);
  });

  it('nests Boards and Calendar under Projects, and gives Attendance its own icon', () => {
    const byLabel = (label: string) => CAMP_NAV.find(item => item.label === label);
    expect(byLabel('Boards')?.under).toBe(ROUTES.projects);
    expect(byLabel('Calendar')?.under).toBe(ROUTES.projects);
    expect(byLabel('Projects')?.under).toBeUndefined();
    expect(byLabel('Attendance')?.icon).toBe('clipboard-check');
    expect(byLabel('Registration')?.icon).toBe('list');
  });

  it('keeps Registration and Holds under Sessions, with their camp-wide addresses', () => {
    const byLabel = (label: string) => CAMP_NAV.find(item => item.label === label);
    expect(byLabel('Registration')).toMatchObject({ href: ROUTES.registration, under: ROUTES.sessions });
    expect(byLabel('Holds')).toMatchObject({ href: ROUTES.holds, under: ROUTES.sessions });
  });

  it('does not list Settings or Help in the sidebar: they live in the profile menu', () => {
    for (const href of [ROUTES.settings, ROUTES.help]) {
      expect(CAMP_NAV.map(item => item.href)).not.toContain(href);
      expect(hrefs('owner')).not.toContain(href);
    }
  });

  it('keeps every route in one place: the nav links only to known routes, and the old kanban address is gone', () => {
    const known: readonly string[] = Object.values(ROUTES);
    for (const item of CAMP_NAV) {
      expect(known).toContain(item.href);
    }
    expect(hrefs('owner')).not.toContain('/kanban');
  });

  it('gives Work and Admin items without a permission, and camp items the permission they had before', () => {
    const requires = Object.fromEntries(CAMP_NAV.map(item => [item.label, item.requires]));
    expect(requires).toMatchObject({
      'Check-in': 'attendance:record',
      'On site': 'attendance:read',
      People: 'people:read',
      Attendance: 'attendance:read',
      Sessions: 'events:read',
      Registration: 'registration:read',
      Holds: 'registration:read',
      'Team access': 'members:read',
      Home: undefined,
      'My tasks': undefined,
      Projects: undefined,
      Reports: 'audit:read',
    });
  });
});

describe('navFor', () => {
  it('shows every item to staff and above that holds its permission; a viewer sees no attendance items (check-in, on site, attendance)', () => {
    // Teachers have their own short sidebar (see teacherNav.test.ts), and My classes is theirs alone, so neither is in this list.
    // Reports needs audit:read, which only admin and owner hold, so staff see every other item.
    for (const role of ROLES.filter(r => r !== 'viewer' && r !== 'teacher')) {
      const expected = CAMP_NAV.filter(
        item => !item.onlyFor && (!item.requires || roleAllows(role, item.requires)),
      ).map(item => item.href);
      expect(hrefs(role)).toEqual(expected);
    }
    expect(hrefs('staff')).not.toContain(ROUTES.reports);
    expect(hrefs('admin')).toContain(ROUTES.reports);
    expect(hrefs('owner')).toContain(ROUTES.reports);
    const attendance: string[] = [ROUTES.checkIn, ROUTES.onSite, ROUTES.attendance, ROUTES.registration];
    expect(hrefs('viewer')).toEqual(
      CAMP_NAV.filter(
        item =>
          !item.onlyFor && (!item.requires || roleAllows('viewer', item.requires)) && !attendance.includes(item.href),
      ).map(item => item.href),
    );
  });

  it('shows only items needing no permission when there is no camp yet', () => {
    expect(hrefs(null)).toEqual([
      ROUTES.camp,
      ROUTES.tasks,
      ROUTES.projects,
      ROUTES.boards,
      ROUTES.calendar,
      ROUTES.agents,
    ]);
  });

  it('hides an item from a role that lacks its permission, and keeps the rest', () => {
    const items = [
      { href: ROUTES.people, label: 'People', icon: 'users', requires: 'people:read' },
      { href: ROUTES.help, label: 'Help', icon: 'help' },
    ] as const;
    expect(navFor(null, items).map(i => i.label)).toEqual(['Help']);
    expect(navFor('viewer', items).map(i => i.label)).toEqual(['People', 'Help']);
  });

  it('works on any item list, so another layout can bring its own', () => {
    const own = [{ href: ROUTES.camp, label: 'Home', icon: 'home' }] as const;
    expect(navFor(null, own)).toEqual(own);
  });
});

describe('navGroupsFor', () => {
  it('keeps the group order and drops a group with nothing left to show', () => {
    expect(groupLabels(navGroupsFor(null))).toEqual(['', 'Work']);
    expect(groupLabels(navGroupsFor('owner'))).toEqual(['', 'Operations', 'Work', 'Admin']);
    const onlyPermitted = [
      { label: 'Gated', items: [{ href: ROUTES.people, label: 'People', icon: 'users', requires: 'people:read' }] },
      { label: 'Open', items: [{ href: ROUTES.help, label: 'Help', icon: 'help' }] },
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
