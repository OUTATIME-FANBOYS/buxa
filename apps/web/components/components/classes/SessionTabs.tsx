'use client';

import { useRouter } from 'next/navigation';
import { SESSION_TAB_LABELS, type SessionTab } from '@buxa/shared';
import { sessionTabPath } from '@/config/routes';
import { Segmented } from '@/components/elements';

/**
 * The tabs on a session's page. Choosing one pushes its URL (`?tab=`), so the choice is in history and survives a refresh. The
 * caller passes only the tabs the person may see.
 */
export function SessionTabs({
  sessionId,
  tabs,
  active,
}: {
  sessionId: string;
  tabs: readonly SessionTab[];
  active: SessionTab;
}) {
  const router = useRouter();

  return (
    <Segmented<SessionTab>
      label="Session sections"
      value={active}
      options={tabs.map(tab => ({ value: tab, label: SESSION_TAB_LABELS[tab] }))}
      onChange={tab => router.push(sessionTabPath(sessionId, tab))}
      className="session-tabs"
    />
  );
}
