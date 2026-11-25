/*
 * Class series: one class a family enrols in once, made of occurrences (one row per day). Pure rules, no I/O.
 *
 * - Planning: a series' weekdays and its first and last allowed times expand into its occurrences (`planSeries`).
 * - Occurrences: one day can be cancelled on its own, with a reason, and restored. A cancelled day stays on the record and
 *   takes no place in a check-in list or on the calendar. Cancelling a day does not change the series (see `decideCancel`).
 * - Overlap across series: a child may not be enrolled in two series whose ACTIVE occurrences overlap (`findSeriesClash`).
 * - Capacity is per series: `seatFor` and `seatsLeft` in capacity.ts apply to the series' taken places.
 */
import { expandClassRule, type Occurrence } from './recurrence';
import { overlaps, type Span } from './interval';
import { parseCampLocal } from './import/campTime';
import type { ClassPrice } from '../prices';

export const OCCURRENCE_STATUSES = ['active', 'cancelled'] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

/** What is written to one day: cancel it with a reason, or restore it. */
export type OccurrenceCommand = { kind: 'cancel'; reason: string } | { kind: 'restore' };

/** The longest reason a cancelled day can carry. Matches the database check on sessions.cancel_reason. */
export const MAX_CANCEL_REASON_LENGTH = 500;

export type WeekdayResult = { ok: true; weekdays: number[] } | { ok: false; message: string };

/**
 * Closed set of ISO weekdays, 1 (Monday) to 7 (Sunday): at least one, no duplicates. Returns them sorted, so two series with the
 * same days compare equal. The New class dialog defaults to Monday to Friday.
 */
export function normaliseWeekdays(days: readonly number[]): WeekdayResult {
  if (days.some(d => !Number.isInteger(d) || d < 1 || d > 7)) {
    return { ok: false, message: 'Choose days of the week from Monday to Sunday.' };
  }
  const distinct = [...new Set(days)].sort((a, b) => a - b);
  if (distinct.length === 0) {
    return { ok: false, message: 'Choose at least one day of the week.' };
  }

  return { ok: true, weekdays: distinct };
}

export const MONDAY_TO_FRIDAY: readonly number[] = [1, 2, 3, 4, 5];

export interface SeriesPlanInput {
  weekdays: readonly number[];
  /** The first allowed time, camp-local, as YYYY-MM-DDTHH:MM. The occurrences start at its clock time. */
  startsLocal: string;
  /** The last allowed time, camp-local, as YYYY-MM-DDTHH:MM. The occurrences end at its clock time. */
  endsLocal: string;
}

export interface PlannedSeries {
  weekdays: number[];
  /** The first allowed start: the first occurrence's start. */
  seriesStartsAt: string;
  /** The last allowed end: the last occurrence's end. */
  seriesEndsAt: string;
  occurrences: Occurrence[];
}

export type SeriesPlan = { ok: true; series: PlannedSeries } | { ok: false; message: string };

const LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

/**
 * Expands a series into its occurrences. Each chosen weekday, from the start date to the end date, gets one occurrence at the
 * start's clock time that ends at the end's clock time. A series that ends before it starts, or ends at the same instant it
 * starts, is refused, and so is one that would have no occurrence or more than the weekly rule allows.
 */
export function planSeries(input: SeriesPlanInput, timeZone: string): SeriesPlan {
  const days = normaliseWeekdays(input.weekdays);
  if (!days.ok) {
    return { ok: false, message: days.message };
  }
  const starts = LOCAL.exec(input.startsLocal);
  const ends = LOCAL.exec(input.endsLocal);
  if (!starts || !ends) {
    return { ok: false, message: 'Use a real start and end date and time.' };
  }
  if (input.endsLocal <= input.startsLocal) {
    return { ok: false, message: 'The series must end after it starts.' };
  }
  const startInstant = parseCampLocal(input.startsLocal, timeZone);
  const endInstant = parseCampLocal(input.endsLocal, timeZone);
  if (!startInstant.ok || !endInstant.ok) {
    return { ok: false, message: 'That time does not exist in the camp time zone. Choose another time.' };
  }

  const rule = expandClassRule(
    {
      weekdays: days.weekdays,
      firstDate: starts[1],
      startTime: starts[2],
      endTime: ends[2],
      end: { kind: 'until', date: ends[1] },
    },
    timeZone,
  );
  if (!rule.ok) {
    return { ok: false, message: rule.message };
  }
  const first = rule.occurrences[0];
  const last = rule.occurrences[rule.occurrences.length - 1];

  return {
    ok: true,
    series: {
      weekdays: days.weekdays,
      seriesStartsAt: first.startsAt,
      seriesEndsAt: last.endsAt,
      occurrences: rule.occurrences,
    },
  };
}

/** A reason is required and short. Returns the trimmed text, or a message for the form. */
export function cancelReasonOf(text: string): { ok: true; reason: string } | { ok: false; message: string } {
  const reason = text.trim();
  if (reason.length === 0) {
    return { ok: false, message: 'Say why this day is cancelled, for example "Public holiday".' };
  }
  if (reason.length > MAX_CANCEL_REASON_LENGTH) {
    return { ok: false, message: `The reason can be ${MAX_CANCEL_REASON_LENGTH} characters at most.` };
  }

  return { ok: true, reason };
}

export interface OccurrenceFacts {
  status: OccurrenceStatus;
}

export type CancelDecision = { kind: 'cancel' } | { kind: 'refuse'; reason: 'already_cancelled' };

/** Only an active day can be cancelled. The series, its other days and its places are left as they are. */
export function decideCancel(occurrence: OccurrenceFacts): CancelDecision {
  return occurrence.status === 'cancelled' ? { kind: 'refuse', reason: 'already_cancelled' } : { kind: 'cancel' };
}

export type RestoreDecision = { kind: 'restore' } | { kind: 'refuse'; reason: 'not_cancelled' };

/** Only a cancelled day can be restored. A restored day keeps its own time; its reason is cleared. */
export function decideRestore(occurrence: OccurrenceFacts): RestoreDecision {
  return occurrence.status === 'active' ? { kind: 'refuse', reason: 'not_cancelled' } : { kind: 'restore' };
}

/** Why a day cannot take the change asked of it. */
export type OccurrenceRefusal = 'already_cancelled' | 'not_cancelled';

/** The refusal copy the screen and the action share, so both say the same thing. */
export function occurrenceRefusalMessage(reason: OccurrenceRefusal): string {
  return reason === 'already_cancelled'
    ? 'This day is already cancelled.'
    : 'This day is not cancelled, so there is nothing to restore.';
}

/** The active days of a series (cancelled ones take no place and clash with nothing). */
export function activeSpans<T extends Span & OccurrenceFacts>(occurrences: readonly T[]): Span[] {
  return occurrences.filter(o => o.status === 'active').map(o => ({ startsAt: o.startsAt, endsAt: o.endsAt }));
}

export interface SeriesSpans {
  seriesId: string;
  /** Active occurrences only. Use `activeSpans` to build it. */
  spans: readonly Span[];
}

export interface SeriesClash {
  seriesId: string;
  /** The candidate's day that clashes. */
  candidate: Span;
  /** The other series' day it clashes with. */
  other: Span;
}

/**
 * The first clash between a candidate series' active days and the active days of the series a child is already enrolled in.
 * Ordered by the candidate's earliest clashing day, so the same clash is reported every time. Touching days (one ends at 12:00,
 * the next starts at 12:00) do not clash, because the comparison is half-open (see interval.ts).
 */
export function findSeriesClash(candidate: readonly Span[], others: readonly SeriesSpans[]): SeriesClash | null {
  let found: SeriesClash | null = null;
  for (const other of others) {
    for (const mine of candidate) {
      for (const theirs of other.spans) {
        if (!overlaps(mine, theirs)) {
          continue;
        }
        if (found === null || Date.parse(mine.startsAt) < Date.parse(found.candidate.startsAt)) {
          found = { seriesId: other.seriesId, candidate: mine, other: theirs };
        }
      }
    }
  }

  return found;
}

/** A day of a series as it is stored: its id, its instants and its status. */
export interface StoredDay {
  id: string;
  startsAt: string;
  endsAt: string;
  status: OccurrenceStatus;
}

/**
 * What an edit of a series' days changes. `add` are planned days no stored day matches (by instant). `removed` are the stored
 * ACTIVE days no planned day matches; `remove` is their ids. A cancelled day that no plan matches stays as it is: it is neither
 * removed nor re-timed by an edit of the days.
 */
export interface SeriesDayDiff<P extends PlannedSpan> {
  /** The planned days no stored day matches, as planned (each keeps its own fields, such as its date). */
  add: P[];
  remove: string[];
  removed: StoredDay[];
}

/** A planned day: its instants. Other fields (such as its date) pass through untouched. */
export interface PlannedSpan {
  startsAt: string;
  endsAt: string;
}

const sameInstant = (a: string, b: string): boolean => Date.parse(a) === Date.parse(b);

/** Compares a series' stored days with the days its new weekdays and times plan. Pure. */
export function diffSeriesDays<P extends PlannedSpan>(
  stored: readonly StoredDay[],
  planned: readonly P[],
): SeriesDayDiff<P> {
  const matches = (day: PlannedSpan, other: StoredDay) =>
    sameInstant(day.startsAt, other.startsAt) && sameInstant(day.endsAt, other.endsAt);
  const add = planned.filter(day => !stored.some(other => matches(day, other)));
  const removed = stored.filter(other => other.status === 'active' && !planned.some(day => matches(day, other)));

  return { add, remove: removed.map(d => d.id), removed };
}

/** A day's label in the camp's zone, for a message: "Mon 12 Jul". */
export function dayLabel(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(instant),
  );
}

/**
 * Why an edit of a series' days is refused: a child (or household) has a place on a day the edit removes. Names the people and the
 * days, and says to unenrol them first, so the staff member knows the next step.
 */
export function seriesDaysInUseMessage(seriesName: string, people: readonly string[], days: readonly string[]): string {
  const names = people.length === 1 ? people[0] : `${people.slice(0, -1).join(', ')} and ${people[people.length - 1]}`;
  const verb = people.length === 1 ? 'is' : 'are';

  return `${names} ${verb} in ${seriesName} on ${days.join(', ')}, which this change removes. Unenrol them first, then save again.`;
}

/** The fields of a series a teacher may not change (the name is the only field a teacher may change). */
export interface SeriesDetails {
  ageRange: { minAge: number; maxAge: number };
  capacity: number;
  location: string;
  instructorIds: readonly string[];
  price: ClassPrice | null;
  weekdays: readonly number[];
  /** The first and last allowed times, camp-local, as YYYY-MM-DDTHH:MM. */
  startsLocal: string;
  endsLocal: string;
}

const samePriceFields = (a: ClassPrice | null, b: ClassPrice | null): boolean =>
  a === null || b === null
    ? a === b
    : a.currency === b.currency &&
      a.regularMinor === b.regularMinor &&
      a.earlyBirdMinor === b.earlyBirdMinor &&
      a.earlyBirdUntil === b.earlyBirdUntil;

/**
 * The locked fields that differ between the saved series and the change. Empty when only the name (or nothing) would change: a
 * teacher on the series may change its name and nothing else.
 */
export function seriesFieldsOutsideDetails(before: SeriesDetails, after: SeriesDetails): string[] {
  const changed: string[] = [];
  if (before.ageRange.minAge !== after.ageRange.minAge || before.ageRange.maxAge !== after.ageRange.maxAge) {
    changed.push('ageRange');
  }
  if (before.capacity !== after.capacity) {
    changed.push('capacity');
  }
  if (before.location !== after.location) {
    changed.push('location');
  }
  if ([...before.instructorIds].sort().join() !== [...after.instructorIds].sort().join()) {
    changed.push('instructorIds');
  }
  if (!samePriceFields(before.price, after.price)) {
    changed.push('price');
  }
  if ([...before.weekdays].sort().join() !== [...after.weekdays].sort().join()) {
    changed.push('weekdays');
  }
  if (before.startsLocal !== after.startsLocal) {
    changed.push('startsLocal');
  }
  if (before.endsLocal !== after.endsLocal) {
    changed.push('endsLocal');
  }

  return changed;
}
