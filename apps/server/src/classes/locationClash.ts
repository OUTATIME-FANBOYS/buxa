import { findLocationClash, locationClashMessage, type LocatedSpan } from '@buxa/domain';
import type { Class } from '@buxa/contracts';
import type { CampClassSpan } from './ClassRepository';
import { RecurrenceRefusedError } from './errors';

/** A day a class is about to take: its camp date (YYYY-MM-DD) and its time range. */
export interface PlacedDay {
  date: string;
  startsAt: string;
  endsAt: string;
}

/** A class already in the camp, as the location rule sees it. */
export type ExistingPlace = LocatedSpan & { className: string };

/** The camp-local calendar date (YYYY-MM-DD) of an instant, in the camp's zone. */
export function campDay(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(instant),
  );
}

/**
 * The location rule (v0.4): a day may not overlap a class in the same location. Classes in other locations may overlap. Each day
 * is checked against `existing` and against the days accepted before it, so the later of two clashing days is the one refused.
 * Throws RecurrenceRefusedError('class_clash') with a message that names the other class, its location and its times, and writes
 * nothing (the caller has not written yet). The database enforces the same rule under concurrency (migration 0066).
 */
export function assertNoLocationClash(
  subject: { name: string; location: string },
  days: readonly PlacedDay[],
  existing: readonly ExistingPlace[],
  timeZone: string,
): void {
  const placed: ExistingPlace[] = [...existing];
  for (const day of days) {
    const candidate = { startsAt: day.startsAt, endsAt: day.endsAt, location: subject.location };
    const clash = findLocationClash(candidate, placed);
    if (clash) {
      throw new RecurrenceRefusedError(
        'class_clash',
        locationClashMessage({ name: subject.name, date: day.date }, clash, timeZone),
      );
    }
    placed.push({ ...candidate, className: subject.name });
  }
}

/** The camp's active classes that a series or a class must not overlap in its location, leaving out one series (its own days). */
export function otherPlaces(spans: readonly CampClassSpan[], ownSeriesId: string | null): ExistingPlace[] {
  return spans.filter(s => s.seriesId !== ownSeriesId);
}

/** A day to check, from a class's times (the camp date is the day of its start). */
export function dayOf(times: { startsAt: string; endsAt: string }, timeZone: string): PlacedDay {
  return { date: campDay(times.startsAt, timeZone), startsAt: times.startsAt, endsAt: times.endsAt };
}

/** The active days of a series, as days to check. Cancelled days take no place, so they are left out. */
export function activeDays(
  days: readonly Pick<Class, 'startsAt' | 'endsAt' | 'occurrenceStatus'>[],
  timeZone: string,
): PlacedDay[] {
  return days.filter(d => d.occurrenceStatus === 'active').map(d => dayOf(d, timeZone));
}
