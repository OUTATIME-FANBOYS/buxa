import type { Metadata } from 'next';
import { requireSession } from '@buxa/server/session/index';
import { Profile } from '@/components/views/kanban';

export const metadata: Metadata = { title: 'Profile' };

/** The signed-in person's profile. It needs a session, not a camp, so it opens with or without one. */
export default async function Page() {
  const session = await requireSession();

  return <Profile user={session.user} />;
}
