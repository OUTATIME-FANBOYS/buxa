/*
 * The tabs on the People page. The URL names the open one in `?tab=` (`people` or `households`), so refresh and back keep it.
 * People is the default: a missing or unknown tab shows the People list.
 */
export const PEOPLE_TABS = ['people', 'households'] as const;
export type PeopleTab = (typeof PEOPLE_TABS)[number];

export const PEOPLE_TAB_LABELS: Record<PeopleTab, string> = {
  people: 'People',
  households: 'Households',
};

/** The tab the URL asks for; anything else (missing, unknown, repeated) is the People list. */
export function resolvePeopleTab(requested: string | string[] | undefined): PeopleTab {
  if (typeof requested !== 'string') {
    return 'people';
  }

  return PEOPLE_TABS.find(tab => tab === requested) ?? 'people';
}
