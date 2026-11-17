import type { Metadata } from 'next';
import { ReportsPage } from '@/components/views/kanban/export';

export const metadata: Metadata = { title: 'Reports' };

export default function Page() {
  return <ReportsPage />;
}
