import type { Metadata } from 'next';
import { Members } from '@/screens';

export const metadata: Metadata = { title: 'Team access' };

export default function Page() {
  return <Members />;
}
