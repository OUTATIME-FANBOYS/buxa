import type { Metadata } from 'next';
import { MyClasses } from '@/components/views/classes';

export const metadata: Metadata = { title: 'My classes' };

/** A teacher's own classes. Anyone else who opens this address sees not found (the view decides). */
export default function Page() {
  return <MyClasses />;
}
