import type { Metadata } from 'next';
import { AttendanceScreen } from '@/components/views/attendance/export';

export const metadata: Metadata = { title: 'Attendance' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <AttendanceScreen searchParams={await searchParams} />;
}
