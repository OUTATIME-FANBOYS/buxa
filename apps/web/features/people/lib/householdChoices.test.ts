import { describe, expect, it } from 'vitest';
import type { Household } from '@buxa/contracts';
import { householdChoiceLabel, toHouseholdChoices } from './householdChoices';

const withGuardian: Household = {
  id: '11111111-1111-4111-8111-111111111111', name: 'Lee family',
  members: [{ personId: '22222222-2222-4222-8222-222222222222', givenName: 'Ana', familyName: 'Lee', roles: ['guardian'], relationship: 'Parent', isGuardian: true, canPickup: false }],
};
const empty: Household = { id: '33333333-3333-4333-8333-333333333333', name: 'Stone family', members: [] };

describe('household choices', () => {
  it('records whether each household has a guardian yet', () => {
    expect(toHouseholdChoices([withGuardian, empty])).toEqual([
      { id: withGuardian.id, name: 'Lee family', hasGuardian: true },
      { id: empty.id, name: 'Stone family', hasGuardian: false },
    ]);
  });

  it('says so in the label only when a child cannot join yet', () => {
    expect(householdChoiceLabel({ id: 'a', name: 'Lee family', hasGuardian: true })).toBe('Lee family');
    expect(householdChoiceLabel({ id: 'b', name: 'Stone family', hasGuardian: false })).toBe('Stone family (no parent or guardian yet)');
  });
});
