import type { Metadata } from 'next';
import { ReportsPage } from '@/features/kanban';

export const metadata: Metadata = { title: 'Reports' };

export default function Page() {
  return <ReportsPage />;
}
