import type { Metadata } from 'next';
import { CalendarPage } from '@/screens';

export const metadata: Metadata = { title: 'Calendar' };

export default function Page() {
  return <CalendarPage />;
}
