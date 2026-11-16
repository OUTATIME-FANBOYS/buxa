import type { Metadata } from 'next';
import { Members } from '@/features/camp/screens/Members';

export const metadata: Metadata = { title: 'Team access' };

export default function Page() {
  return <Members />;
}
