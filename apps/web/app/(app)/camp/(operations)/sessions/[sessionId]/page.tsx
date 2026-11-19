import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isUuid } from '@buxa/domain';
import { ClassPage } from '@/components/views/classes';

export const metadata: Metadata = { title: 'Session' };

/** A session's page. The id is checked before anything else: anything that is not a UUID is simply not found. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) {
    notFound();
  }

  return <ClassPage classId={sessionId} searchParams={await searchParams} />;
}
