import type { Metadata } from 'next';
import { BoardRoutePage } from '@/features/kanban';

export const metadata: Metadata = { title: 'Board' };

/** The board of one project: its board, list, calendar and timeline views. */
export default async function Page(props: PageProps<'/camp/boards/[projectId]'>) {
  const { projectId } = await props.params;
  return <BoardRoutePage projectId={projectId} />;
}
