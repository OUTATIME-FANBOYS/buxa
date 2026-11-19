import type { Metadata } from 'next';
import { RegistrationList } from '@/components/views/registration';

export const metadata: Metadata = { title: 'Registration' };

/** The camp's registration forms, one per season or session set. */
export default function Page() {
  return <RegistrationList />;
}
