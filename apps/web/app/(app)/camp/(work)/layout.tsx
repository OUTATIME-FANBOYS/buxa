import type { ReactNode } from 'react';
import { AccountMenu } from '@/components/components/camp/export';
import { CampSwitcher } from '@/components/components/camp/export';
import { WorkFrame } from '@/components/views/camp/export';
import { TaskTopBar } from '@/components/components/kanban/topbar/export';
import { WorkArea } from '@/components/views/kanban/export';
import { getCurrentCamp, requireSession } from '@buxa/server/session/index';
import { listArchivedCamps } from '@/actions/camp';

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
  const archived = !!camp && archivedCamps.some(c => c.id === camp.orgId);

  return (
    <WorkArea user={user} campRole={camp?.role ?? null} archived={archived}>
      <WorkFrame
        role={camp?.role ?? null}
        archived={archived}
        topBarStart={<CampSwitcher camps={session.memberships} current={camp} archivedCamps={archivedCamps} />}
        topBarEnd={<TaskTopBar account={<AccountMenu user={session.user} />} />}
      >
        {children}
      </WorkFrame>
    </WorkArea>
  );
}
