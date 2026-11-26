import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Household } from '@buxa/contracts';
import { HouseholdDirectory } from '@/components/components/people';
import { householdRoleLabel } from '@/components/components/people/householdRoles';

const cole: Household = {
  id: 'h-1',
  name: 'The Coles',
  members: [
    {
      personId: 'p-1',
      givenName: 'Ana',
      familyName: 'Cole',
      roles: ['guardian'],
      relationship: 'Mother',
      isGuardian: true,
      canPickup: true,
    },
    {
      personId: 'p-2',
      givenName: 'Ben',
      familyName: 'Cole',
      roles: ['camper'],
      relationship: 'Son',
      isGuardian: false,
      canPickup: false,
    },
  ],
};
const stone: Household = { id: 'h-2', name: 'Stone family', members: [] };

describe('HouseholdDirectory', () => {
  it('lists every household with its members, their roles, and a link to each household page', () => {
    const html = renderToStaticMarkup(<HouseholdDirectory households={[cole, stone]} query="" />);
    expect(html).toContain('The Coles');
    expect(html).toContain('Stone family');
    expect(html).toContain('Ana Cole');
    expect(html).toContain('Guardian');
    expect(html).toContain('Child');
    expect(html).toContain('href="/camp/households/h-1"');
    expect(html).toContain('href="/camp/households/h-2"');
    expect(html).toContain('2 households');
  });

  it('has no new household button and no add button', () => {
    const html = renderToStaticMarkup(<HouseholdDirectory households={[cole, stone]} query="" />);
    expect(html).not.toMatch(/new household|add household|add a household/i);
    expect(html).not.toContain('Add person');
  });

  it('searches by household name, keeping the tab in the form', () => {
    const html = renderToStaticMarkup(<HouseholdDirectory households={[cole, stone]} query="stone" />);
    expect(html).toContain('name="tab" value="households"');
    expect(html).toContain('name="q" value="stone"');
    expect(html).toContain('Stone family');
    expect(html).not.toContain('The Coles');
  });

  it('says so when no household matches the search, and when the camp has none yet', () => {
    expect(renderToStaticMarkup(<HouseholdDirectory households={[cole]} query="zzz" />)).toContain(
      'No household matches that search.',
    );
    expect(renderToStaticMarkup(<HouseholdDirectory households={[]} query="" />)).toContain('No households yet.');
  });
});

describe('householdRoleLabel', () => {
  it('reads a camper as Child, a guardian as Guardian, and otherwise the relationship or the camp role', () => {
    expect(householdRoleLabel({ roles: ['camper'], isGuardian: false, relationship: 'Son' })).toBe('Child');
    expect(householdRoleLabel({ roles: ['guardian'], isGuardian: true, relationship: 'Mother' })).toBe('Guardian');
    expect(householdRoleLabel({ roles: ['guardian'], isGuardian: false, relationship: 'Aunt' })).toBe('Aunt');
    expect(householdRoleLabel({ roles: ['guardian'], isGuardian: null, relationship: null })).not.toBe('');
  });
});
