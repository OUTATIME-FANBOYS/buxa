import type { Metadata } from 'next';
import { ClassList } from '@/views/export';

export const metadata: Metadata = { title: 'Classes' };

/** The camp's classes and how to reach their sessions. */
export default function Page() {
  return <ClassList />;
}
