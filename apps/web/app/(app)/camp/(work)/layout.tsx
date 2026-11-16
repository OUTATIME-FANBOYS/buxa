import type { ReactNode } from 'react';
import { AccountMenu, CampSwitcher, WorkFrame } from '@/features/camp';
import { TaskTopBar, WorkArea } from '@/features/kanban';
import { getCurrentCamp, getOptionalSession } from '@/server/session';

/**
 * The shell for every work page: tasks, projects, boards, calendar, agents, reports and settings.
 * It does not require a session, because the browser demo (kept in this browser) can use these pages without one.
 * A real session adds the camp switcher and the account menu; the task data itself stays in the browser.
 */
export default async function WorkLayout({ children }: { children: ReactNode }) {
  const session = await getOptionalSession();
  const camp = session ? await getCurrentCamp(session) : null;
  return (
    <WorkArea realSession={session !== null}>
      <WorkFrame
        role={camp?.role ?? null}
        topBarStart={session ? <CampSwitcher camps={session.memberships} current={camp} /> : null}
        topBarEnd={<TaskTopBar account={session ? <AccountMenu user={session.user} /> : undefined} />}>
        {children}
      </WorkFrame>
    </WorkArea>
  );
}
