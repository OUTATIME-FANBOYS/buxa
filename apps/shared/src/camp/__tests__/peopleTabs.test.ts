import { describe, expect, it } from 'vitest';
import { PEOPLE_TABS, PEOPLE_TAB_LABELS, resolvePeopleTab } from '../peopleTabs';
import { householdPath, peopleTabPath, ROUTES } from '../../config/routes';

describe('People tabs', () => {
  it('has the two tabs, People first, with their labels', () => {
    expect(PEOPLE_TABS).toEqual(['people', 'households']);
    expect(PEOPLE_TAB_LABELS).toEqual({ people: 'People', households: 'Households' });
  });

  it('shows the tab the address names in ?tab=', () => {
    expect(resolvePeopleTab('households')).toBe('households');
    expect(resolvePeopleTab('people')).toBe('people');
  });

  it('falls back to People for a missing, unknown or repeated tab', () => {
    expect(resolvePeopleTab(undefined)).toBe('people');
    expect(resolvePeopleTab('')).toBe('people');
    expect(resolvePeopleTab('nonsense')).toBe('people');
    expect(resolvePeopleTab(['households', 'households'])).toBe('people');
  });

  it('builds the tab address and the household page address', () => {
    expect(peopleTabPath('households')).toBe(`${ROUTES.people}?tab=households`);
    expect(householdPath('h 1')).toBe(`${ROUTES.households}/h%201`);
    expect(ROUTES.households).toBe('/camp/households');
  });
});
