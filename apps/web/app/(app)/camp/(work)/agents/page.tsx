import type { Metadata } from 'next';
import { AgentsPage } from '@/screens';

export const metadata: Metadata = { title: 'Agents' };

export default function Page() {
  return <AgentsPage />;
}
