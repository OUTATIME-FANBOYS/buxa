import type { Metadata } from 'next';
import { OnSiteScreen } from '@/components/views/attendance/export';

export const metadata: Metadata = { title: 'On site' };

export default function Page() {
  return <OnSiteScreen />;
}
