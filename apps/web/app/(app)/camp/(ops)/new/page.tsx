import type { Metadata } from 'next';
import { NewCampForm } from '@/components';

export const metadata: Metadata = { title: 'New camp' };

export default function Page() {
  return <NewCampForm first={false} />;
}
