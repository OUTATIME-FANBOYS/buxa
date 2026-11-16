import { authorize, can } from '@buxa/domain';
import type { PersonSummary } from '@buxa/contracts';
import { getRuntime } from '../../../server/runtime';
import { campContext } from './campContext';

/** What the camp Home shows. A count is null when the viewer's role may not read it, so the page never shows a number its own page would refuse. */
export interface CampHome {
  campId: string;
  name: string;
  firstName: string;
  /** Owners and admins may rename the camp (org:update). */
  canRename: boolean;
  /** People on the camp list. */
  people: number | null;
  /** Checked in and not yet checked out. */
  onSite: number | null;
  /** People whose membership is valid today. */
  validMemberships: number | null;
}

const firstNameOf = (name: string): string => name.trim().split(/\s+/)[0] ?? '';

/** Camp facts for the Home page, read through the same services the camp's own pages use. */
export async function loadCampHome(): Promise<CampHome> {
  const { session, actor } = await campContext();
  const { services } = getRuntime();
  const org = await services.orgs.getCamp(actor);
  const people: Promise<PersonSummary[] | null> = authorize(actor, 'people:read').allow ? services.people.list(actor) : Promise.resolve(null);
  const onSite: Promise<number | null> = authorize(actor, 'attendance:read').allow
    ? services.attendance.onSite(actor).then(entries => entries.length)
    : Promise.resolve(null);
  const [list, onSiteCount] = await Promise.all([people, onSite]);
  return {
    campId: org.id,
    name: org.name,
    firstName: firstNameOf(session.user.name),
    canRename: can(actor, 'org:update'),
    people: list ? list.length : null,
    onSite: onSiteCount,
    validMemberships: list ? list.filter(person => person.status === 'valid').length : null,
  };
}
