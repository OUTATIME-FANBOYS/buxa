import type { Metadata } from 'next';
import { RegistrationList } from '@/components/views/registration';

export const metadata: Metadata = { title: 'Registration' };

/** The camp's registration forms, one per season or session set. `?session=` narrows them and their registrations to one session. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <RegistrationList searchParams={await searchParams} />;
}
