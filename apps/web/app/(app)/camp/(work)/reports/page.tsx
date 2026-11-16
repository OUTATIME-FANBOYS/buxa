import type { Metadata } from 'next';
import { ReportsPage } from '@/views/export';

export const metadata: Metadata = { title: 'Reports' };

export default function Page() {
  return <ReportsPage />;
}
