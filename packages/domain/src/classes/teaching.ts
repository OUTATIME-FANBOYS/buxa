/*
 * The teaching rule: which sessions and classes a teacher teaches. One rule for My classes, the attendance filters and the
 * attendance rows. A session is a parent row (a date range); a class here is a series, and each of its days is a row with a status.
 * A cancelled day is not on a teacher's plan (migration 0064).
 */

/** A day of a class, as the teaching rule reads it: which session and series it belongs to, and whether it is cancelled. */
export interface TeachingDay {
  readonly id: string;
  readonly sessionId: string;
  readonly seriesId: string;
  readonly occurrenceStatus: 'active' | 'cancelled';
}

/** The sessions a teacher teaches at least one class in, and the classes (series) it teaches. */
export interface TeachingScope {
  readonly sessionIds: ReadonlySet<string>;
  readonly seriesIds: ReadonlySet<string>;
}

/** The days a teacher teaches: every active day, and no cancelled one. */
export function teachingDays<T extends TeachingDay>(days: readonly T[]): T[] {
  return days.filter(day => day.occurrenceStatus === 'active');
}

/** The scope a set of days gives a teacher. Cancelled days are left out. */
export function teachingScopeOf(days: readonly TeachingDay[]): TeachingScope {
  const active = teachingDays(days);

  return {
    sessionIds: new Set(active.map(day => day.sessionId)),
    seriesIds: new Set(active.map(day => day.seriesId)),
  };
}

/**
 * Whether a visit (its session and its class series) is one the teacher teaches. The visit's session must be one the teacher
 * teaches in. Its class must be one the teacher teaches, when the visit names one; a visit with no known class is judged by its
 * session. A camp-day visit has no session, so it is never a teacher's.
 */
export function teachesVisit(
  scope: TeachingScope,
  visit: { readonly sessionId: string | null; readonly classId: string | null },
): boolean {
  if (visit.sessionId === null || !scope.sessionIds.has(visit.sessionId)) {
    return false;
  }

  return visit.classId === null || scope.seriesIds.has(visit.classId);
}
