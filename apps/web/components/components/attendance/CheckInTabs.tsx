'use client';

import { useRouter } from 'next/navigation';
import { CHECK_IN_TAB_LABELS, type CheckInTab } from '@buxa/shared';
import { ROUTES } from '@/config/routes';
import { Segmented } from '@/components/elements';

/**
 * The tabs under the check-in header. Choosing one pushes its URL (`?tab=`), so the choice is in history and survives a refresh. The
 * caller passes only the tabs the person may use. It is the session page's tab control, with the check-in labels.
 */
export function CheckInTabs({ tabs, active }: { tabs: readonly CheckInTab[]; active: CheckInTab }) {
  const router = useRouter();

  return (
    <Segmented<CheckInTab>
      label="Check-in sections"
      value={active}
      options={tabs.map(tab => ({ value: tab, label: CHECK_IN_TAB_LABELS[tab] }))}
      onChange={tab => router.push(`${ROUTES.checkIn}?tab=${tab}`)}
      className="session-tabs"
    />
  );
}
