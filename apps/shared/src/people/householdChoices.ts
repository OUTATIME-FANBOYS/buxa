import type { Household } from '@buxa/contracts';

/** A household offered in a picker: its id, its name, and whether a camper could join it yet (it has a parent or guardian). */
export interface HouseholdChoice { id: string; name: string; hasGuardian: boolean }

/** The picker's choices from the camp's households, in the order the service gave (by name). */
export const toHouseholdChoices = (households: readonly Household[]): HouseholdChoice[] =>
  households.map(h => ({ id: h.id, name: h.name, hasGuardian: h.members.some(m => m.isGuardian) }));

/** The option text. A household with no guardian yet says so, because a child cannot join it. */
export const householdChoiceLabel = (choice: HouseholdChoice): string =>
  choice.hasGuardian ? choice.name : `${choice.name} (no parent or guardian yet)`;
