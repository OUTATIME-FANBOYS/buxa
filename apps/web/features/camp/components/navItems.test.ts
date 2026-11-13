import { describe, expect, it } from 'vitest';
import { ROLES } from '@buxa/domain';
import { ROUTES } from '@/config/routes';
import { CAMP_NAV, isActive, navFor } from './navItems';

const hrefs = (role: Parameters<typeof navFor>[0]) => navFor(role).map(item => item.href);

describe('navFor', () => {
  it('shows every item to a member of a camp', () => {
    for (const role of ROLES) expect(hrefs(role)).toEqual(CAMP_NAV.map(item => item.href));
  });

  it('shows only items needing no permission when there is no camp yet', () => {
    expect(hrefs(null)).toEqual([ROUTES.kanban]);
  });

  it('works on any item list, so another layout can bring its own', () => {
    const own = [{ href: ROUTES.home, label: 'Home', icon: 'home' }] as const;
    expect(navFor(null, own)).toEqual(own);
  });
});

describe('isActive', () => {
  const overview = { href: ROUTES.camp, exact: true };
  const members = { href: ROUTES.members };

  it('matches an exact item only on its own address', () => {
    expect(isActive(ROUTES.camp, overview)).toBe(true);
    expect(isActive(ROUTES.members, overview)).toBe(false);
  });

  it('matches a non-exact item on its address and beneath it, not on a look-alike', () => {
    expect(isActive(ROUTES.members, members)).toBe(true);
    expect(isActive(`${ROUTES.members}/42`, members)).toBe(true);
    expect(isActive(`${ROUTES.members}ship`, members)).toBe(false);
  });
});
