import 'server-only';
import type { Actor } from '@buxa/domain';
import { getRuntime } from '../../runtime';
import type { PersonSummary } from '@buxa/contracts';
import { isHttpError } from '../../http/errors';
import { toListQuery, type ListParams } from '@buxa/shared';

/** The households a staff member can link someone into. */
export const loadHouseholdList = (actor: Actor) => getRuntime().services.people.listHouseholds(actor);

/** People matching a name search, for linking into a household (the service caps the matches). */
export const loadPersonMatches = (actor: Actor, query: string) => getRuntime().services.people.list(actor, { query });

/** The people list for the search and role filter in the URL. */
export const loadPeople = (actor: Actor, params: ListParams) =>
  getRuntime().services.people.list(actor, toListQuery(params));

/** The people list, or 'forbidden' when the role may not list people (403). Other failures are thrown for the error boundary. */
export async function loadPeopleOrForbidden(actor: Actor, params: ListParams): Promise<PersonSummary[] | 'forbidden'> {
  try {
    return await loadPeople(actor, params);
  } catch (error) {
    if (isHttpError(error) && error.statusCode === 403) {
      return 'forbidden';
    }
    throw error;
  }
}
