import type { Metadata } from 'next';
import { CheckInScreen } from '@/screens';

export const metadata: Metadata = { title: 'Check-in' };

export default function Page() {
  return <CheckInScreen />;
}
