import type { Metadata } from 'next';
import { ImportClasses } from '@/features/classes';

export const metadata: Metadata = { title: 'Import classes' };

export default function Page() {
  return <ImportClasses />;
}
