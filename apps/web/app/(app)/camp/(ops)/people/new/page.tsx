import type { Metadata } from 'next';
import { NewPerson } from '@/screens';

export const metadata: Metadata = { title: 'Add person' };

export default async function Page({ searchParams }: { searchParams: Promise<{ household?: string | string[] }> }) {
  const { household } = await searchParams;
  return <NewPerson householdId={typeof household === 'string' ? household : undefined} />;
}
