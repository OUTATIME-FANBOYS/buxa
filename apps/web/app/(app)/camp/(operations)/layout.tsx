import type { ReactNode } from 'react';
import { CampFrame } from '@/components/views/camp';
import { getCurrentCamp, requireSession, toActor } from '@buxa/server/session/index';
import { teachingViewOf } from '@buxa/server/composers/members/withMemberOptions';
import { listArchivedCamps } from '@/actions/camp';
import { loadNotifications } from '@buxa/server/composers/notifications/loadNotifications';

export default async function CampLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const camp = await getCurrentCamp(session);
  const teaching = await teachingViewOf(camp ? toActor(session, camp) : null);
  const archivedCamps = await listArchivedCamps();
  const notifications = await loadNotifications();

  return (
    <CampFrame
      user={session.user}
      camps={session.memberships}
      current={camp}
      teaching={teaching}
      archivedCamps={archivedCamps}
      notifications={{ items: notifications.rows, unread: notifications.unread }}
    >
      {children}
    </CampFrame>
  );
}
