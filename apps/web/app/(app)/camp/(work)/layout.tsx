import type { ReactNode } from 'react';
import { AccountMenu } from '@/components';
import { CampSwitcher } from '@/components';
import { WorkFrame } from '@/features/camp/screens/WorkFrame';
import { TaskTopBar } from '@/components';
import { WorkArea } from '@/features/kanban/WorkArea';
import { getCurrentCamp, requireSession } from '@/server/session';

/**
 * The shell for every work page: tasks, projects, boards, calendar, agents, reports and settings.
 * It needs a session: the board acts as the signed-in person, and anyone else is sent to sign-in.
 * The task data itself stays in the browser; the camp switcher and account menu come from the session.
 */
export default async function WorkLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const camp = await getCurrentCamp(session);
  const user = { id: session.user.id, name: session.user.name, email: session.user.email };
  return (
    <WorkArea user={user}>
      <WorkFrame
        role={camp?.role ?? null}
        topBarStart={<CampSwitcher camps={session.memberships} current={camp} />}
        topBarEnd={<TaskTopBar account={<AccountMenu user={session.user} />} />}>
        {children}
      </WorkFrame>
    </WorkArea>
  );
}
