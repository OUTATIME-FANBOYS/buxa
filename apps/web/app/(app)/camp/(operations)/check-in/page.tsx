import type { Metadata } from 'next';
import { CheckInScreen } from '@/components/views/attendance';

export const metadata: Metadata = { title: 'Check-in' };

export default function Page() {
  return <CheckInScreen />;
}
