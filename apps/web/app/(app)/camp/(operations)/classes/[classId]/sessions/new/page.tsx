import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isUuid } from '@buxa/domain';
import { NewSession } from '@/views';

export const metadata: Metadata = { title: 'Add session' };

export default async function Page({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  if (!isUuid(classId)) notFound();
  return <NewSession classId={classId} />;
}
