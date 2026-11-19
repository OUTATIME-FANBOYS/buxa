import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isUuid } from '@buxa/domain';
import { NewClass } from '@/components/views/classes';

export const metadata: Metadata = { title: 'New class' };

/** Adds a class to the session in the path. The same form opens in a dialog from the session page; this page serves direct links. */
export default async function Page({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  if (!isUuid(classId)) {
    notFound();
  }

  return <NewClass sessionId={classId} />;
}
