import type { Metadata } from 'next';
import { ReportsPage } from '@/screens';

export const metadata: Metadata = { title: 'Reports' };

export default function Page() {
  return <ReportsPage />;
}
