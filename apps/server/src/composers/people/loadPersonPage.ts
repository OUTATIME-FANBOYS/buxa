import 'server-only';
import type { Actor } from '@buxa/domain';
import { getRuntime } from '../../runtime';
import type { PersonPage } from '@buxa/contracts';
import { isHttpError } from '../../http/errors';
import { toPageQuery, type ListParams } from '@buxa/shared';

/** The households a staff member can link someone into. */
export const loadHouseholdList = (actor: Actor) => getRuntime().services.people.listHouseholds(actor);

/** People matching a name search, for linking into a household (the service caps the matches). */
export const loadPersonMatches = (actor: Actor, query: string) => getRuntime().services.people.list(actor, { query });

/** One page of the people list for the search, role and page in the URL. */
export const loadPeoplePage = (actor: Actor, params: ListParams) =>
  getRuntime().services.people.listPage(actor, toPageQuery(params));

/** One page of the people list, or 'forbidden' when the role may not list people (403). Other failures are thrown for the error boundary. */
export async function loadPeoplePageOrForbidden(actor: Actor, params: ListParams): Promise<PersonPage | 'forbidden'> {
  try {
    return await loadPeoplePage(actor, params);
  } catch (error) {
    if (isHttpError(error) && error.statusCode === 403) {
      return 'forbidden';
    }
    throw error;
  }
}
