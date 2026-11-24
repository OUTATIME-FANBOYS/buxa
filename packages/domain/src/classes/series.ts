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
