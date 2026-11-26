'use client';

import { useRouter } from 'next/navigation';
import { PEOPLE_TABS, PEOPLE_TAB_LABELS, type PeopleTab } from '@buxa/shared';
import { peopleTabPath } from '@/config/routes';
import { Segmented } from '@/components/elements';

/**
 * The tabs under the People header. Choosing one pushes its URL (`?tab=`), so the choice is in history and survives a refresh.
 * Both tabs are the same for every viewer who may see the People page.
 */
export function PeopleTabs({ active }: { active: PeopleTab }) {
  const router = useRouter();

  return (
    <Segmented<PeopleTab>
      label="People sections"
      value={active}
      options={PEOPLE_TABS.map(tab => ({ value: tab, label: PEOPLE_TAB_LABELS[tab] }))}
      onChange={tab => router.push(peopleTabPath(tab))}
      className="people-tabs"
    />
  );
}
