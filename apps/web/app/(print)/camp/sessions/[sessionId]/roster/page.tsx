import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isUuid } from '@buxa/domain';
import { RosterPage } from '@/components/views/groups';

export const metadata: Metadata = { title: 'Roster' };

/**
 * A session's printable roster. It lives in the (print) group, outside (app)/camp, so the camp's sidebar and topbar are not drawn:
 * the page is plain, with print styles. The id is checked first: anything that is not a UUID is simply not found.
 */
export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) {
    notFound();
  }

  return <RosterPage sessionId={sessionId} />;
}
