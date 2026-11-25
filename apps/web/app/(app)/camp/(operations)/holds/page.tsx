import type { Metadata } from 'next';
import { CampHolds } from '@/components/views/holds';

export const metadata: Metadata = { title: 'Holds' };

/** The places held across the camp, and each class's waitlist beside them. Read only. `?session=` narrows both to one session. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CampHolds searchParams={await searchParams} />;
}
