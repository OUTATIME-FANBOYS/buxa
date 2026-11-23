import type { HouseholdRecord } from '../../people/PeopleRepository';

/**
 * The children of a guardian: the non-guardian members of every household where `guardianId` is a guardian. Pure, so the rule that
 * decides who may show a child's badge is written once and tested on its own.
 */
export function childIdsOf(guardianId: string, households: readonly HouseholdRecord[]): string[] {
  const childIds = new Set<string>();
  for (const household of households) {
    const self = household.members.find(member => member.personId === guardianId);
    if (!self?.isGuardian) {
      continue;
    }
    for (const member of household.members) {
      if (member.personId !== guardianId && !member.isGuardian) {
        childIds.add(member.personId);
      }
    }
  }

  return [...childIds];
}
