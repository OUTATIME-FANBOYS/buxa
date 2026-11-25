import type { ReactNode } from 'react';
import { AccountMenu } from '@/components/components/camp';
import { CampSwitcher } from '@/components/components/camp';
import { WorkFrame } from '@/components/views/camp';
import { TaskTopBar } from '@/components/components/kanban/topbar';
import { WorkArea } from '@/components/views/kanban';
import { getCurrentCamp, requireSession, toActor } from '@buxa/server/session/index';
import { teachingViewOf } from '@buxa/server/composers/members/withMemberOptions';
import { listArchivedCamps } from '@/actions/camp';
import { loadNotifications } from '@buxa/server/composers/notifications/loadNotifications';

/**
 * The shell for admin pages: team access and settings.
 * Settings reads the same browser store as the work pages (agents on or off, theme), so this shell provides it too.
 * It needs a session, like the work shell. Without a camp, each page decides what to show.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const camp = await getCurrentCamp(session);
  const user = { id: session.user.id, name: session.user.name, email: session.user.email };
  const archivedCamps = await listArchivedCamps();
  // An archived camp opens read-only: the store and the services refuse every write, and the page shows the banner.
  const archived = camp?.archived ?? false;
  const teaching = await teachingViewOf(camp ? toActor(session, camp) : null);
  const notifications = await loadNotifications();

  return (
    <WorkArea user={user} archived={archived}>
      <WorkFrame
        role={camp?.role ?? null}
        teaching={teaching}
        archived={archived}
        topBarStart={<CampSwitcher camps={session.memberships} current={camp} archivedCamps={archivedCamps} />}
        topBarEnd={
          <TaskTopBar
            account={<AccountMenu user={session.user} hasCamp={camp !== null} />}
            items={notifications.rows}
            unread={notifications.unread}
          />
        }
      >
        {children}
      </WorkFrame>
    </WorkArea>
  );
}
