import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isUuid } from '@buxa/domain';
import { ClassPage } from '@/views';

export const metadata: Metadata = { title: 'Class' };

/** A class's page. The id is checked before anything else: anything that is not a UUID is simply not found. */
export default async function Page({ params, searchParams }: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { classId } = await params;
  if (!isUuid(classId)) notFound();
  return <ClassPage classId={classId} searchParams={await searchParams} />;
}
