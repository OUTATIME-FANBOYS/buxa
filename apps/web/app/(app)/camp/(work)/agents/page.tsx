import type { Metadata } from 'next';
import { AgentsPage } from '@/components/views/kanban';

export const metadata: Metadata = { title: 'Agents' };

export default function Page() {
  return <AgentsPage />;
}
