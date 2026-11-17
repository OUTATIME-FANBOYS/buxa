import type { Metadata } from 'next';
import { NewClass } from '@/views';

export const metadata: Metadata = { title: 'New class' };

export default function Page() {
  return <NewClass />;
}
