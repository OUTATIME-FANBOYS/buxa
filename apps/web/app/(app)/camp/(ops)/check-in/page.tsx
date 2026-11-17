import type { Metadata } from 'next';
import { CheckInScreen } from '@/views/export';

export const metadata: Metadata = { title: 'Check-in' };

export default function Page() {
  return <CheckInScreen />;
}
