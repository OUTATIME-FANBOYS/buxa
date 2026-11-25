import { TEACHER_CLASS_FIELDS } from '../permissions';
import type { ClassPrice } from '../prices';

/**
 * A class's fields as a teacher's change is compared. A teacher may change only the name (TEACHER_CLASS_FIELDS); every other field
 * below needs classes:manage. A class has no description of its own.
 */
export interface ClassDetails {
  ageRange: { minAge: number; maxAge: number };
  capacity: number;
  startsAt: string;
  endsAt: string;
  location: string;
  instructorIds: readonly string[];
  price: ClassPrice | null;
}

/** The fields a teacher may not change, as the names the screens and refusals use. */
const LOCKED: readonly (keyof ClassDetails)[] = [
  'ageRange',
  'capacity',
  'startsAt',
  'endsAt',
  'location',
  'instructorIds',
  'price',
];

const sameInstant = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();

const samePrice = (a: ClassPrice | null, b: ClassPrice | null): boolean =>
  a === null || b === null
    ? a === b
    : a.currency === b.currency &&
      a.regularMinor === b.regularMinor &&
      a.earlyBirdMinor === b.earlyBirdMinor &&
      a.earlyBirdUntil === b.earlyBirdUntil;

/**
 * The locked fields (everything but the name and description) that differ between the saved class and the change. Empty when the
 * change touches only the details a teacher may change. Pure: the service calls it, the screens do not need it.
 */
export function classFieldsOutsideDetails(before: ClassDetails, after: ClassDetails): string[] {
  const changed: string[] = [];
  for (const field of LOCKED) {
    const same =
      field === 'ageRange'
        ? before.ageRange.minAge === after.ageRange.minAge && before.ageRange.maxAge === after.ageRange.maxAge
        : field === 'startsAt'
          ? sameInstant(before.startsAt, after.startsAt)
          : field === 'endsAt'
            ? sameInstant(before.endsAt, after.endsAt)
            : field === 'instructorIds'
              ? [...before.instructorIds].sort().join() === [...after.instructorIds].sort().join()
              : field === 'price'
                ? samePrice(before.price, after.price)
                : before[field] === after[field];
    if (!same) {
      changed.push(field);
    }
  }

  return changed;
}

/** The fields a teacher may change, for a refusal that says what is allowed. */
export const TEACHER_EDITABLE_FIELDS: readonly string[] = TEACHER_CLASS_FIELDS;
