import type { Metadata } from 'next';
import { AgentsPage } from '@/features/kanban/pages';

export const metadata: Metadata = { title: 'Agents' };

export default function Page() {
  return <AgentsPage />;
}
