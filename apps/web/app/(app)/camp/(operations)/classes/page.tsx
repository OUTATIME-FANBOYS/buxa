import type { Metadata } from 'next';
import { ClassList } from '@/components/views/classes';

export const metadata: Metadata = { title: 'Classes' };

/** The camp's classes and how to reach their sessions. */
export default function Page() {
  return <ClassList />;
}
