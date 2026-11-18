import type { Metadata } from 'next';
import { NewCampForm } from '@/components/components/camp';
import { getCurrentCamp, requireSession } from '@buxa/server/session/index';

export const metadata: Metadata = { title: 'New camp' };

/** Create a camp. With no camp yet this is the first-run setup; otherwise it adds another camp. */
export default async function Page() {
  const camp = await getCurrentCamp(await requireSession());

  return <NewCampForm first={!camp} />;
}
