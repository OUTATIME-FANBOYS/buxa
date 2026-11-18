import type { ReactNode } from 'react';
import { AccountMenu } from '@/components/components/camp/export';
import { CampSwitcher } from '@/components/components/camp/export';
import { WorkFrame } from '@/components/views/camp/export';
import { TaskTopBar } from '@/components/components/kanban/topbar/export';
import { WorkArea } from '@/components/views/kanban/export';
import { getCurrentCamp, requireSession } from '@buxa/server/session/index';
import { listArchivedCamps } from '@/actions/camp';

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
  const archived = !!camp && archivedCamps.some(c => c.id === camp.orgId);

  return (
    <WorkArea user={user} archived={archived}>
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
