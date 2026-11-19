import type { ReactNode } from 'react';
import { CampFrame } from '@/components/views/camp';
import { getCurrentCamp, requireSession } from '@buxa/server/session/index';
import { listArchivedCamps } from '@/actions/camp';

export default async function CampLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const camp = await getCurrentCamp(session);
  const archivedCamps = await listArchivedCamps();

  return (
    <CampFrame user={session.user} camps={session.memberships} current={camp} archivedCamps={archivedCamps}>
      {children}
    </CampFrame>
  );
}
