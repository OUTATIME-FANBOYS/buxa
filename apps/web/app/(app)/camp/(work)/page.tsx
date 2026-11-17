import type { Metadata } from 'next';
import { NewCampForm } from '@/components/components/camp/export';
import { HomePage } from '@/components/views/kanban/export';
import { loadHomeCamp } from '@/components/views/kanban/export';
import { getCurrentCamp, requireSession } from '@buxa/server/session/index';

export const metadata: Metadata = { title: 'Home' };

/** Home: the camp's dashboard. With no camp yet, first-run setup comes first. */
export default async function Page() {
  const session = await requireSession();
  const camp = await getCurrentCamp(session);
  if (!camp) return <NewCampForm first />;
  return <HomePage camp={await loadHomeCamp()} />;
}
