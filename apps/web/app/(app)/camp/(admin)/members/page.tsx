import type { Metadata } from 'next';
import { NewCampForm } from '@/components';
import { Members } from '@/views';
import { getCurrentCamp, requireSession } from '@buxa/server/session/index';

export const metadata: Metadata = { title: 'Team access' };

/** Team access. With no camp yet, first-run setup is shown instead, as it was before this page moved to admin. */
export default async function Page() {
  const camp = await getCurrentCamp(await requireSession());
  if (!camp) return <NewCampForm first />;
  return <Members />;
}
