import { classWithinSession, type SessionDays } from './sessionDates';

/*
 * A class whose time range falls outside its session's dates is flagged (classes-dates flag, migration 0059). The flag is kept in
 * step with the dates on every session save and class save: a flagged class is one whose days are outside its session's days.
 * A flagged class takes no enrolment, seat hold or registration, and its session cannot go live, until its dates are fixed.
 */

/** What a person sees when a flagged class is asked for a place, a hold or a registration. */
export const CLASS_DATES_FLAGGED_MESSAGE = "This class falls outside its session's dates. Fix its dates first.";

/** Null when a class may take people; otherwise the message to show. `datesOutsideSession` is the stored flag. */
export function classDatesRefusal(datesOutsideSession: boolean): string | null {
  return datesOutsideSession ? CLASS_DATES_FLAGGED_MESSAGE : null;
}

/** A class as the session date change sees it: its times, its flag, and whether anyone is attached to it. */
export interface DatesPlanClass {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  /** The stored flag before the change. */
  datesOutsideSession: boolean;
  /**
   * True when the class has an enrolment, a seat hold or a registration, or its session has a check-in (check-ins name the session,
   * not a class, so one check-in blocks a change that would flag any of its classes).
   */
  hasPeople: boolean;
}

export interface NamedClass {
  id: string;
  name: string;
}

/** What a session date change does to its classes. Nothing is written by this function. */
export interface SessionDatesPlan {
  /** Every class outside the new dates. Each one ends up flagged. */
  outside: NamedClass[];
  /** The classes that are outside and were not flagged before: one audit entry each. */
  newlyFlagged: NamedClass[];
  /** Ids of flagged classes that the new dates cover again. Their flag is cleared. */
  cleared: string[];
  /** Classes that would be outside the new dates and have people on them. A change with any of these is refused. */
  blocked: NamedClass[];
}

/**
 * Plans a session's new date range over its classes. A class outside the new days is flagged, and its times are kept. A class with
 * people on it that would be outside is blocked (the whole change is refused, so nothing is flagged or saved).
 */
export function planSessionDates(
  classes: readonly DatesPlanClass[],
  days: SessionDays,
  timeZone: string,
): SessionDatesPlan {
  const outside: NamedClass[] = [];
  const newlyFlagged: NamedClass[] = [];
  const cleared: string[] = [];
  const blocked: NamedClass[] = [];
  for (const cls of classes) {
    const isOutside = !classWithinSession(cls, days, timeZone);
    if (isOutside) {
      const named = { id: cls.id, name: cls.name };
      outside.push(named);
      if (!cls.datesOutsideSession) {
        newlyFlagged.push(named);
      }
      if (cls.hasPeople) {
        blocked.push(named);
      }
    } else if (cls.datesOutsideSession) {
      cleared.push(cls.id);
    }
  }

  return { outside, newlyFlagged, cleared, blocked };
}

function nameList(names: readonly string[]): string {
  return names.join(', ');
}

/** The refusal for a shrink that would flag classes with people on them. Names every such class. */
export function sessionDatesBlockedMessage(names: readonly string[]): string {
  if (names.length === 1) {
    return `${names[0]} would fall outside the new dates, and it has people on it. Move or cancel it first, then change the session dates.`;
  }

  return `${names.length} classes would fall outside the new dates and have people on them: ${nameList(names)}. Move or cancel them first, then change the session dates.`;
}

/** The refusal for taking a session live while any of its classes is flagged. */
export function sessionPublishBlockedMessage(names: readonly string[]): string {
  if (names.length === 1) {
    return `This session cannot go live: ${names[0]} has dates outside the session. Fix its dates first.`;
  }

  return `This session cannot go live: ${names.length} classes have dates outside the session (${nameList(names)}). Fix their dates first.`;
}
