import type { Metadata } from 'next';
import { PeopleList } from '@/features/people';

export const metadata: Metadata = { title: 'People' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PeopleList searchParams={await searchParams} />;
}
