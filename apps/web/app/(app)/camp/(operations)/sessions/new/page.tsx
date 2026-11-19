import type { Metadata } from 'next';
import { NewSession } from '@/components/views/classes';

export const metadata: Metadata = { title: 'New session' };

export default function Page() {
  return <NewSession />;
}
