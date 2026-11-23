import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isUuid } from '@buxa/domain';
import { GroupsPage } from '@/components/views/groups';

export const metadata: Metadata = { title: 'Groups and rooms' };

/** A session's groups and rooms. The id is checked first: anything that is not a UUID is simply not found. */
export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) {
    notFound();
  }

  return <GroupsPage sessionId={sessionId} />;
}
