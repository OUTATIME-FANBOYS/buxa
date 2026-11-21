import type { PersonPageQuery } from '@buxa/contracts';
import type { PersonPageFilter } from '../../people/PeopleRepository';
import type { TeacherScope } from '../../classes/teacherScope';

/**
 * The filter for one page of the people list: the search words, the role, and for a teacher only their campers. The repository
 * applies it before counting and before paging, so the total and the page always describe the same people.
 */
export function personPageFilter(query: PersonPageQuery, scope: TeacherScope | null): PersonPageFilter {
  return {
    term: query.query?.trim() ?? '',
    ...(query.role === undefined ? {} : { role: query.role }),
    ...(scope === null ? {} : { ids: [...scope.camperIds] }),
  };
}
