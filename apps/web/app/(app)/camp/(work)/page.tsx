import type { Metadata } from 'next';
import { NewCampForm } from '@/features/camp/forms/NewCampForm';
import { loadCampHome } from '@/features/camp/lib/campHome';
import { HomePage } from '@/features/kanban/pages';
import { getCurrentCamp, getOptionalSession } from '@/server/session';

export const metadata: Metadata = { title: 'Home' };

/** Home: one page with the camp's facts and the staff tasks. With a session but no camp yet, first-run setup comes first. */
export default async function Page() {
  const session = await getOptionalSession();
  const camp = session ? await getCurrentCamp(session) : null;
  if (session && !camp) return <NewCampForm first />;
  return <HomePage camp={camp ? await loadCampHome() : null} />;
}
