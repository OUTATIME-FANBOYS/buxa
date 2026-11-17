import type { Metadata } from 'next';
import { ImportClasses } from '@/views';

export const metadata: Metadata = { title: 'Import classes' };

export default function Page() {
  return <ImportClasses />;
}
