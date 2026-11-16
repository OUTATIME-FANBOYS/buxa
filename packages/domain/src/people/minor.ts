import type { CampRole } from './roles';
import type { LocalDate } from './localDate';

export const ADULT_AGE = 18;

/** Whole years between `born` and `today` (both YYYY-MM-DD). */
export function ageOn(born: LocalDate, today: LocalDate): number {
  const [by, bm, bd] = born.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/**
 * Under 18 on the camp's local day. Safe by default: a camper with no date of birth is treated as a minor.
 * A known date of birth always wins, so an adult listed as a camper is not treated as a child.
 */
export function isMinor(person: { dateOfBirth: LocalDate | null; roles: readonly CampRole[] }, today: LocalDate): boolean {
  if (person.dateOfBirth !== null) return ageOn(person.dateOfBirth, today) < ADULT_AGE;
  return person.roles.includes('camper');
}
