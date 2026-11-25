/*
 * Classes in one location may not overlap in time. Classes in different locations may (owner decision, v0.4). Pure rules, no I/O.
 *
 * The location is compared the way rooms are: case and spacing insensitive (nameKey). The database enforces the same rule with an
 * exclusion constraint on the occurrence rows (migration 0066, buxa_name_key), so keep the two in step.
 */
import { findClash, type Span } from './interval';
import { formatClash } from './refusals';
import { nameKey } from './sessionName';

/** A span with the location it is held in. */
export interface LocatedSpan extends Span {
  location: string;
}

/** Two locations are the same place when their keys match: "  Lab   1 " and "lab 1" are one room. */
export function sameLocation(a: string, b: string): boolean {
  return nameKey(a) === nameKey(b);
}

/** The first of `others` that overlaps `candidate` in the same location (earliest start). Other locations never clash. */
export function findLocationClash<T extends LocatedSpan>(candidate: LocatedSpan, others: readonly T[]): T | null {
  return findClash(
    candidate,
    others.filter(o => sameLocation(o.location, candidate.location)),
  );
}

/** The refusal for a class that overlaps another in the same location. Names the class, its location and its times. */
export function locationClashMessage(
  subject: { name: string; date: string },
  clash: LocatedSpan & { className: string },
  timeZone: string,
): string {
  return `${subject.name} on ${subject.date} clashes with ${clash.className} at ${clash.location} (${formatClash(clash, timeZone)}). Two classes in the same location cannot overlap. Choose other times, days or a location; nothing was saved.`;
}
