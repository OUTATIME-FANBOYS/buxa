import type { Metadata } from 'next';
import { CheckInScreen } from '@/features/attendance/screens/CheckInScreen';

export const metadata: Metadata = { title: 'Check-in' };

export default function Page() {
  return <CheckInScreen />;
}
