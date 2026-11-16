import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isUuid } from '@buxa/domain';
import { EditPerson } from '@/features/people';

export const metadata: Metadata = { title: 'Edit person' };

/** Change a person's details. Like the person's page, a non-UUID id is simply not found. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return <EditPerson id={id} />;
}
