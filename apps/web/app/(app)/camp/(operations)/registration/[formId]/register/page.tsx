import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isUuid } from '@buxa/domain';
import { RegisterFamilyView } from '@/components/views/registration';

export const metadata: Metadata = { title: 'Take a registration' };

/** Records one family's registration on a published form. */
export default async function Page({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  if (!isUuid(formId)) {
    notFound();
  }

  return <RegisterFamilyView formId={formId} />;
}
