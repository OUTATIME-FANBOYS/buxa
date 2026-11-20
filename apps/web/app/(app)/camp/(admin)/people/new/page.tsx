import type { Metadata } from 'next';
import { NewPerson } from '@/components/views/people';

export const metadata: Metadata = { title: 'Add person' };

export default async function Page({ searchParams }: { searchParams: Promise<{ household?: string | string[] }> }) {
  const { household } = await searchParams;

  return <NewPerson householdId={typeof household === 'string' ? household : undefined} />;
}
