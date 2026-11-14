import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isUuid } from '@buxa/domain';
import { PersonScreen } from '@/features/people';

export const metadata: Metadata = { title: 'Person' };

/** A person's page. The id is checked before anything else: anything that is not a UUID is simply not found. */
export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return <PersonScreen id={id} searchParams={await searchParams} />;
}
