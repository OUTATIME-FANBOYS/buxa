import { authorize, can, isMinor, toLocalDate } from '@buxa/domain';
import type { Actor, LocalDate } from '@buxa/domain';
import type { PersonSummary, Session } from '@buxa/contracts';
import type { OnSiteEntry } from '@buxa/shared/attendance/types';
import { getRuntime } from '../../runtime';
import { MAX_LOG_ROWS } from '../../attendance/AttendanceRepository';
import { campContext } from './campContext';

import type { CampHome, CheckInsByDay, MembershipStatusCounts, UpcomingSession } from '@buxa/shared/camp/campHomeTypes';
export type { CampHome, UpcomingSession };

const firstNameOf = (name: string): string => name.trim().split(/\s+/)[0] ?? '';
/** How many upcoming sessions the Home page lists. */
const UPCOMING_LIMIT = 5;
/**
 * How many camp-local days the check-in chart reads, ending today. The page offers 7, 14 and 30 days, and compares each with the
 * same number of days before it, so the window is twice the longest range.
 */
export const CHART_DAYS = 60;

/** Camp facts for the Home page, read through the same services the camp's own pages use. A fact the viewer may not read is null. */
export async function loadCampHome(): Promise<CampHome> {
  const { session, actor } = await campContext();
  const { services } = getRuntime();
  const org = await services.orgs.getCamp(actor);
  const today = toLocalDate(new Date(), org.timezone);
  const canAttendance = authorize(actor, 'attendance:read').allow;
  const canEvents = authorize(actor, 'events:read').allow;

  const people: Promise<PersonSummary[] | null> = authorize(actor, 'people:read').allow ? services.people.list(actor) : Promise.resolve(null);
  const onSite: Promise<OnSiteEntry[] | null> = canAttendance ? services.attendance.onSite(actor) : Promise.resolve(null);
  // One read covers the whole chart window. Each visit is bucketed by the camp-local day it happened on.
  const visits = canAttendance
    ? services.attendance.log(actor, { from: daysBefore(today, CHART_DAYS - 1), to: today })
    : Promise.resolve(null);
  const upcoming: Promise<UpcomingSession[] | null> = canEvents ? upcomingSessions(actor) : Promise.resolve(null);

  const [list, onSiteEntries, visitEntries, sessions] = await Promise.all([people, onSite, visits, upcoming]);
  // The minor flag is contact-level: only roles that may read contact details get the split. Everyone else gets the totals alone.
  const minors = visitEntries && can(actor, 'people:read_contact')
    ? await minorsAmong(actor.orgId, visitEntries.map(v => v.personId), today)
    : null;
  const checkInsByDay = visitEntries
    ? checkInsPerDay(visitEntries, today, org.timezone, visitEntries.length < MAX_LOG_ROWS, minors)
    : null;
  const membershipStatus = membershipCounts(list);

  return {
    campId: org.id,
    name: org.name,
    firstName: firstNameOf(session.user.name),
    canRename: can(actor, 'org:update'),
    people: list ? list.length : null,
    onSite: onSiteEntries ? onSiteEntries.length : null,
    checkedInToday: checkInsByDay ? checkInsByDay.days[checkInsByDay.days.length - 1].count : null,
    // From the membership counts, so a viewer who cannot see status gets null, not a false zero.
    validMemberships: membershipStatus ? membershipStatus.valid : null,
    upcomingSessions: sessions,
    checkInsByDay,
    onSiteByAge: onSiteEntries ? onSiteAgeGroups(onSiteEntries) : null,
    membershipStatus,
  };
}

/** The day `n` days before a camp-local day (a pure calendar step, no zone involved). */
export function daysBefore(day: LocalDate, n: number): LocalDate {
  const [y, m, d] = day.split('-').map(Number);

  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

/** The ids among `personIds` who are students (minors) today. Reads the people directly, as the age split needs their dates of birth. */
async function minorsAmong(orgId: string, personIds: readonly string[], today: LocalDate): Promise<Set<string>> {
  const records = await getRuntime().repositories.people.getMany(orgId, [...new Set(personIds)]);

  return new Set(records.filter(person => isMinor(person, today)).map(person => person.id));
}

/**
 * People checked in per camp-local day, for the CHART_DAYS days ending `today`, oldest first. A person who checked in twice on a
 * day counts once. `complete` is passed in: false when the read hit its row limit. `minorIds` is the students among the visitors,
 * or null when the viewer may not see the minor flag (then every day's `minors` is null).
 */
export function checkInsPerDay(
  visits: readonly { personId: string; checkedInAt: string }[], today: LocalDate, timeZone: string, complete: boolean,
  minorIds: ReadonlySet<string> | null,
): CheckInsByDay {
  const byDay = new Map<LocalDate, Set<string>>();
  for (const visit of visits) {
    const day = toLocalDate(new Date(visit.checkedInAt), timeZone);
    const people = byDay.get(day) ?? new Set<string>();
    people.add(visit.personId);
    byDay.set(day, people);
  }
  const days = Array.from({ length: CHART_DAYS }, (_, i) => {
    const date = daysBefore(today, CHART_DAYS - 1 - i);
    const people = byDay.get(date) ?? new Set<string>();
    const minors = minorIds === null ? null : [...people].filter(id => minorIds.has(id)).length;

    return { date, count: people.size, minors };
  });

  return { days, complete };
}

/** Adults and minors on site. Null when the minor flag is hidden from this viewer (it is null on every entry then). */
export function onSiteAgeGroups(entries: readonly OnSiteEntry[]): { adults: number; minors: number } | null {
  if (entries.some(entry => entry.isMinor === null)) {
    return null;
  }
  const minors = entries.filter(entry => entry.isMinor === true).length;

  return { adults: entries.length - minors, minors };
}

/** Membership status across the camp list. Null when the list hides status from this viewer. `revoked` counts as none. */
export function membershipCounts(list: readonly PersonSummary[] | null): MembershipStatusCounts | null {
  if (!list || list.some(person => person.status === null)) {
    return null;
  }
  const counts: MembershipStatusCounts = { valid: 0, notStarted: 0, expired: 0, none: 0 };
  for (const person of list) {
    if (person.status === 'valid') {
      counts.valid += 1;
    } else if (person.status === 'not_started') {
      counts.notStarted += 1;
    } else if (person.status === 'expired') {
      counts.expired += 1;
    } else {
      counts.none += 1;
    }
  }

  return counts;
}

/** The next sessions of every class, soonest first. Needs events:read (checked by the caller). */
async function upcomingSessions(actor: Actor): Promise<UpcomingSession[]> {
  const { classes } = getRuntime().services;
  const listed = await classes.listClasses(actor);
  if (!listed.ok) {
    return [];
  }
  const now = Date.now();
  const perClass = await Promise.all(listed.value.map(async cls => {
    const sessions = await classes.listSessions(actor, cls.id);

    return sessions.ok ? sessions.value : [];
  }));

  return perClass.flat()
    .filter((s: Session) => Date.parse(s.startsAt) >= now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, UPCOMING_LIMIT)
    .map(s => ({ id: s.id, className: s.className, startsAt: s.startsAt, location: s.location }));
}
