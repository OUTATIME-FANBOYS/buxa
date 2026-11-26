import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isUuid } from '@buxa/domain';
import { HouseholdScreen } from '@/components/views/households';

export const metadata: Metadata = { title: 'Household' };

/** A household's page. The id is checked before anything else: anything that is not a UUID is simply not found. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { householdId } = await params;
  if (!isUuid(householdId)) {
    notFound();
  }

  return <HouseholdScreen householdId={householdId} searchParams={await searchParams} />;
}
