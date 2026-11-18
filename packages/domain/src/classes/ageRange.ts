import { ageOn } from '../people/minor';
import type { LocalDate } from '../people/localDate';

/** Minimum and maximum age for a class, both inclusive. */
export interface AgeRange {
  minAge: number;
  maxAge: number;
}

export const MAX_AGE_LIMIT = 120;

export function isValidAgeRange(r: AgeRange): boolean {
  return (
    Number.isInteger(r.minAge) &&
    Number.isInteger(r.maxAge) &&
    r.minAge >= 0 &&
    r.maxAge <= MAX_AGE_LIMIT &&
    r.minAge <= r.maxAge
  );
}

export type AgeCheck = { ok: true; age: number } | { ok: false; age: number; range: AgeRange };

/** The camper's age on `onDay` (the camp-local day the session starts), checked against the range. */
export function checkAge(dateOfBirth: LocalDate, onDay: LocalDate, range: AgeRange): AgeCheck {
  const age = ageOn(dateOfBirth, onDay);

  return age >= range.minAge && age <= range.maxAge ? { ok: true, age } : { ok: false, age, range };
}
