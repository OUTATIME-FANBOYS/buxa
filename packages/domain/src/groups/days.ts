import type { Span } from '../classes/interval';
import type { LocalDate } from '../people/localDate';

/** The day after a camp day, as a YYYY-MM-DD string. Works on the calendar, so the camp's zone never changes the answer. */
function nextDay(day: LocalDate): LocalDate {
  const next = new Date(`${day}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);

  return next.toISOString().slice(0, 10);
}

/**
 * The camp days from `startsOn` through `endsOn`, both included, as a half-open span for the overlap rule (phase 2). Two sessions
 * whose last and first days are consecutive days touch, and do not overlap; sharing any day overlaps.
 */
export function daySpan(startsOn: LocalDate, endsOn: LocalDate): Span {
  return { startsAt: `${startsOn}T00:00:00.000Z`, endsAt: `${nextDay(endsOn)}T00:00:00.000Z` };
}

/** "1 Jul 2027", for a refusal's copy. */
export function formatDay(day: LocalDate): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${day}T00:00:00.000Z`),
  );
}
