'use server';

import { MAX_SEARCH_RESULTS, settle } from '@buxa/domain';
import { getRuntime } from '../../runtime';
import { cardsFor, type PersonCard } from '@buxa/shared';
import { SearchInputSchema } from '@buxa/shared';
import { runAttendanceAction } from './runAction';
import type { ActionOutcome } from '@buxa/shared';

/** Type-ahead name search for the check-in screen. At most MAX_SEARCH_RESULTS people; an empty query finds nobody. */
export function searchPeopleAction(input: unknown): Promise<ActionOutcome<PersonCard[]>> {
  return settle(() => {
    return runAttendanceAction(SearchInputSchema, input, async (actor, data) => {
      if (data.query === '') {
        return [];
      }
      const { services } = getRuntime();
      const people = await services.people.list(actor, { query: data.query });

      return cardsFor(people.slice(0, MAX_SEARCH_RESULTS), await services.attendance.onSite(actor));
    });
  });
}
