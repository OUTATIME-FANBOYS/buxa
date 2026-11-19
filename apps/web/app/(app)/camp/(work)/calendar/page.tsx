import type { Metadata } from 'next';
import { CalendarPage } from '@/components/views/kanban';

export const metadata: Metadata = { title: 'Calendar' };

export default function Page() {
  return <CalendarPage />;
}
