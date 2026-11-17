import type { Metadata } from 'next';
import { NewCampForm } from '@/components/components/camp/export';
import { HomePage } from '@/components/views/kanban/export';
import { loadHomeCamp } from '@/components/views/kanban/export';
import { getCurrentCamp, getOptionalSession } from '@buxa/server/session/index';

export const metadata: Metadata = { title: 'Home' };

/** Home: one page with the camp's facts and the staff tasks. With a session but no camp yet, first-run setup comes first. */
export default async function Page() {
  const session = await getOptionalSession();
  const camp = session ? await getCurrentCamp(session) : null;
  if (session && !camp) return <NewCampForm first />;
  return <HomePage camp={camp ? await loadHomeCamp() : null} />;
}
