import type { Metadata } from 'next';
import { CalendarPage } from '@/features/kanban/pages';

export const metadata: Metadata = { title: 'Calendar' };

export default function Page() {
  return <CalendarPage />;
}
