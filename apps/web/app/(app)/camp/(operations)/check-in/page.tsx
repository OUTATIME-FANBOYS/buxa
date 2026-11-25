import type { Metadata } from 'next';
import { CheckInScreen } from '@/components/views/attendance';

export const metadata: Metadata = { title: 'Check-in' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CheckInScreen searchParams={await searchParams} />;
}
