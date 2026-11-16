import type { Metadata } from 'next';
import { CalendarPage } from '@/views/export';

export const metadata: Metadata = { title: 'Calendar' };

export default function Page() {
  return <CalendarPage />;
}
