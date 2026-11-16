import type { Metadata } from 'next';
import { ReportsPage } from '@/features/kanban/pages';

export const metadata: Metadata = { title: 'Reports' };

export default function Page() {
  return <ReportsPage />;
}
