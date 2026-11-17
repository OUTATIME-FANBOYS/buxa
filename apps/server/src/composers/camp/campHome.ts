import { authorize, can, toLocalDate } from '@buxa/domain';
import type { Actor } from '@buxa/domain';
import type { PersonSummary, Session } from '@buxa/contracts';
import { getRuntime } from '../../runtime';
import { campContext } from './campContext';

import type { CampHome, UpcomingSession } from '@buxa/shared/camp/campHomeTypes';
export type { CampHome, UpcomingSession };

const firstNameOf = (name: string): string => name.trim().split(/\s+/)[0] ?? '';
/** How many upcoming sessions the Home page lists. */
const UPCOMING_LIMIT = 5;

/** Camp facts for the Home page, read through the same services the camp's own pages use. A fact the viewer may not read is null. */
export async function loadCampHome(): Promise<CampHome> {
  const { session, actor } = await campContext();
  const { services } = getRuntime();
  const org = await services.orgs.getCamp(actor);
  const today = toLocalDate(new Date(), org.timezone);
  const canAttendance = authorize(actor, 'attendance:read').allow;
  const canEvents = authorize(actor, 'events:read').allow;

  const people: Promise<PersonSummary[] | null> = authorize(actor, 'people:read').allow ? services.people.list(actor) : Promise.resolve(null);
  const onSite: Promise<number | null> = canAttendance ? services.attendance.onSite(actor).then(entries => entries.length) : Promise.resolve(null);
  // Distinct people who checked in on the camp's local day, whether or not they have left since.
  const checkedIn: Promise<number | null> = canAttendance
    ? services.attendance.log(actor, { from: today, to: today }).then(entries => new Set(entries.map(e => e.personId)).size)
    : Promise.resolve(null);
  const upcoming: Promise<UpcomingSession[] | null> = canEvents ? upcomingSessions(actor) : Promise.resolve(null);

  const [list, onSiteCount, checkedInCount, sessions] = await Promise.all([people, onSite, checkedIn, upcoming]);
  return {
    campId: org.id,
    name: org.name,
    firstName: firstNameOf(session.user.name),
    canRename: can(actor, 'org:update'),
    people: list ? list.length : null,
    onSite: onSiteCount,
    checkedInToday: checkedInCount,
    validMemberships: list ? list.filter(person => person.status === 'valid').length : null,
    upcomingSessions: sessions,
  };
}

/** The next sessions of every class, soonest first. Needs events:read (checked by the caller). */
async function upcomingSessions(actor: Actor): Promise<UpcomingSession[]> {
  const { classes } = getRuntime().services;
  const listed = await classes.listClasses(actor);
  if (!listed.ok) return [];
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
