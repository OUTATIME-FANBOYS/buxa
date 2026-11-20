import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isUuid } from '@buxa/domain';
import { RegistrationFormView } from '@/components/views/registration';

export const metadata: Metadata = { title: 'Registration form' };

/** A registration form: its draft, publishing, and its registrations by session. Anything that is not a UUID is simply not found. */
export default async function Page({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  if (!isUuid(formId)) {
    notFound();
  }

  return <RegistrationFormView formId={formId} />;
}
