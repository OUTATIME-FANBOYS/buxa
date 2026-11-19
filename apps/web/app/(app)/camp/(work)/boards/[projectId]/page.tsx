import type { Metadata } from 'next';
import { BoardRoutePage } from '@/components/views/kanban';

export const metadata: Metadata = { title: 'Board' };

/** The board of one project: its board, list, calendar and timeline views. */
export default async function Page(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;

  return <BoardRoutePage projectId={projectId} />;
}
