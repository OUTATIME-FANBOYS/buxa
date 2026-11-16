'use server';

import { MAX_SEARCH_RESULTS } from '@buxa/domain';
import { getRuntime } from '@/server/runtime';
import { cardsFor, type PersonCard } from '../lib/card';
import { SearchInputSchema } from '../lib/inputs';
import { runAttendanceAction } from '../lib/runAction';
import type { ActionOutcome } from './outcome';

/** Type-ahead name search for the check-in screen. At most MAX_SEARCH_RESULTS people; an empty query finds nobody. */
export async function searchPeopleAction(input: unknown): Promise<ActionOutcome<PersonCard[]>> {
  return runAttendanceAction(SearchInputSchema, input, async (actor, data) => {
    if (data.query === '') return [];
    const { services } = getRuntime();
    const people = await services.people.list(actor, { query: data.query });
    return cardsFor(people.slice(0, MAX_SEARCH_RESULTS), await services.attendance.onSite(actor));
  });
}
