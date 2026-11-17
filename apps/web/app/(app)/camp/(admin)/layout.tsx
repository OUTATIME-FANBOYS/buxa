import type { ReactNode } from 'react';
import { AccountMenu } from '@/components';
import { CampSwitcher } from '@/components';
import { WorkFrame } from '@/views';
import { TaskTopBar } from '@/components';
import { WorkArea } from '@/views';
import { getCurrentCamp, requireSession } from '@/server/session';

/**
 * The shell for admin pages: team access and settings.
 * Settings reads the same browser store as the work pages (agents on or off, theme), so this shell provides it too.
 * It needs a session, like the work shell. Without a camp, each page decides what to show.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
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
