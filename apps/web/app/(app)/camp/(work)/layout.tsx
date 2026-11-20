import type { ReactNode } from 'react';
import { AccountMenu } from '@/components/components/camp';
import { CampSwitcher } from '@/components/components/camp';
import { WorkFrame } from '@/components/views/camp';
import { TaskTopBar } from '@/components/components/kanban/topbar';
import { WorkArea } from '@/components/views/kanban';
import { getCurrentCamp, requireSession } from '@buxa/server/session/index';
import { listArchivedCamps } from '@/actions/camp';
import { loadNotifications } from '@buxa/server/composers/notifications/loadNotifications';

/**
 * The shell for the work pages: home, tasks, projects, boards, calendar, agents and reports.
 * It needs a session: the board acts as the signed-in person, and anyone else is sent to sign-in.
 * The task data itself stays in the browser; the camp switcher and account menu come from the session.
 */
export default async function WorkLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const camp = await getCurrentCamp(session);
  const user = { id: session.user.id, name: session.user.name, email: session.user.email };
  const archivedCamps = await listArchivedCamps();
  // An archived camp opens read-only: the store and the services refuse every write, and the page shows the banner.
  const archived = camp?.archived ?? false;
  const notifications = await loadNotifications();

  return (
    <WorkArea user={user} campRole={camp?.role ?? null} archived={archived}>
      <WorkFrame
        role={camp?.role ?? null}
        archived={archived}
        topBarStart={<CampSwitcher camps={session.memberships} current={camp} archivedCamps={archivedCamps} />}
        topBarEnd={
          <TaskTopBar
            account={<AccountMenu user={session.user} />}
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
