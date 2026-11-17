import 'server-only';
import type { Actor } from '@buxa/domain';
import { getRuntime } from '../../runtime';

type AttendanceService = ReturnType<typeof getRuntime>['services']['attendance'];

/** Who is on site now, for the on-site screen. */
export const loadOnSiteEntries = (actor: Actor) => getRuntime().services.attendance.onSite(actor);

/** Everyone the log filter can name. */
export const loadPeopleOptions = (actor: Actor) => getRuntime().services.people.list(actor);

/** The visits in a filtered range, for the log. */
export const loadLogEntries = (actor: Actor, filter: Parameters<AttendanceService['log']>[1]) =>
  getRuntime().services.attendance.log(actor, filter);

/** One person's visits, for their page. */
export const loadVisitHistory = (actor: Actor, personId: string) => getRuntime().services.attendance.history(actor, personId);
