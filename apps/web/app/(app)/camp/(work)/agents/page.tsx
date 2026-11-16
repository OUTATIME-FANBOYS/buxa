import type { Metadata } from 'next';
import { AgentsPage } from '@/views/export';

export const metadata: Metadata = { title: 'Agents' };

export default function Page() {
  return <AgentsPage />;
}
