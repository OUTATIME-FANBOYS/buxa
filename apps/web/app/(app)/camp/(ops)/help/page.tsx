import type { Metadata } from 'next';
import { HelpPage } from '@/screens';

export const metadata: Metadata = { title: 'Help' };

/** Help for every camp member. No permission is needed to read it. */
export default function Page() {
  return <HelpPage />;
}
