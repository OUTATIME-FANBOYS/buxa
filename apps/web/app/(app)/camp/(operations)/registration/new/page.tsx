import type { Metadata } from 'next';
import { NewRegistrationFormView } from '@/components/views/registration';

export const metadata: Metadata = { title: 'New registration form' };

/** Creates a registration form for a season. */
export default function Page() {
  return <NewRegistrationFormView />;
}
