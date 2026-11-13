import type { Metadata } from 'next';
import { NewCamp } from '@/features/camp/screens/NewCamp';

export const metadata: Metadata = { title: 'New camp' };

export default function Page() {
  return <NewCamp first={false} />;
}
