import type { Metadata } from 'next';
import { ImportClasses } from '@/components/views/classes/export';

export const metadata: Metadata = { title: 'Import classes' };

export default function Page() {
  return <ImportClasses />;
}
