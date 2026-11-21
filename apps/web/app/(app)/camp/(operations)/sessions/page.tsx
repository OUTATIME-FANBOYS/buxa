import type { Metadata } from 'next';
import { deletedSessionName } from '@buxa/shared';
import { ClassList } from '@/components/views/classes';

export const metadata: Metadata = { title: 'Classes' };

/** The camp's classes and how to reach their sessions. `?deleted=<name>` (set after a delete) shows a toast. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return <ClassList deletedName={deletedSessionName(params.deleted)} />;
}
