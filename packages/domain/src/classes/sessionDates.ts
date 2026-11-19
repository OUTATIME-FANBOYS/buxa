import { toLocalDate, type LocalDate } from '../people/localDate';

/** A session's date range: camp-local days, both inclusive. */
export interface SessionDays {
  startsOn: LocalDate;
  endsOn: LocalDate;
}

/**
 * True when a class's time range falls on days inside the session's date range, read in the camp's zone. Times are instants,
 * so the zone is what decides which day a class is on.
 */
export function classWithinSession(
  classTimes: { startsAt: string; endsAt: string },
  session: SessionDays,
  timeZone: string,
): boolean {
  const first = toLocalDate(new Date(classTimes.startsAt), timeZone);
  const last = toLocalDate(new Date(classTimes.endsAt), timeZone);

  return first >= session.startsOn && last <= session.endsOn;
}
