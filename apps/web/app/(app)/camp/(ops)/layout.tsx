import type { ReactNode } from 'react';
import { CampFrame } from '@/views/export';
import { getCurrentCamp, requireSession } from '@/server/session';

export default async function CampLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const camp = await getCurrentCamp(session);
  return <CampFrame user={session.user} camps={session.memberships} current={camp}>{children}</CampFrame>;
}
