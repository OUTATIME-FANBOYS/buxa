import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isUuid } from '@buxa/domain';
import { AssignPage } from '@/components/views/groups';

export const metadata: Metadata = { title: 'Assign people' };

/** A session's assign page. The id is checked first: anything that is not a UUID is simply not found. */
export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) {
    notFound();
  }

  return <AssignPage sessionId={sessionId} />;
}
