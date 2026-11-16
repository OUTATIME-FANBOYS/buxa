import type { Metadata } from 'next';
import { NewCampForm } from '@/features/camp/forms/NewCampForm';

export const metadata: Metadata = { title: 'New camp' };

export default function Page() {
  return <NewCampForm first={false} />;
}
