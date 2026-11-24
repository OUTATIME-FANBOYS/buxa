/** A session the check-in screen can offer: a camp session in progress today or starting today. */
export interface CheckInSessionOption {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
}

/** The fields of a session that decide whether it is offered. Dates are camp-local days (YYYY-MM-DD) or null when not set. */
export interface SessionDates {
  id: string;
  name: string;
  startsOn: string | null;
  endsOn: string | null;
}

/**
 * The sessions whose camp days include `today`: in progress, or starting today. A session with no dates is never offered,
 * since it has no day to be in progress on. The input order is kept.
 */
export function sessionsOpenOn(sessions: readonly SessionDates[], today: string): CheckInSessionOption[] {
  return sessions
    .filter(
      (s): s is SessionDates & { startsOn: string; endsOn: string } =>
        s.startsOn !== null && s.endsOn !== null && s.startsOn <= today && today <= s.endsOn,
    )
    .map(s => ({ id: s.id, name: s.name, startsOn: s.startsOn, endsOn: s.endsOn }));
}

/** The session to pre-select: the only one on offer. With none, or several, nothing is pre-selected. */
export function defaultSessionId(options: readonly CheckInSessionOption[]): string | null {
  return options.length === 1 ? options[0].id : null;
}
