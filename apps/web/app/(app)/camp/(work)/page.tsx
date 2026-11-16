import type { Metadata } from 'next';
import { NewCampForm, Overview } from '@/features/camp';
import { HomePage } from '@/features/kanban';
import { getCurrentCamp, getOptionalSession } from '@/server/session';

export const metadata: Metadata = { title: 'Home' };

/** Home: the camp's overview above the task dashboard. With a session but no camp yet, first-run setup comes first. */
export default async function Page() {
  const session = await getOptionalSession();
  const camp = session ? await getCurrentCamp(session) : null;
  if (session && !camp) return <NewCampForm first />;
  return <HomePage overview={camp ? <Overview /> : null} />;
}
