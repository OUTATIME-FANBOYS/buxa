import type { Metadata } from 'next';
import { BoardsPage } from '@/features/kanban';

export const metadata: Metadata = { title: 'Boards' };

export default function Page() {
  return <BoardsPage />;
}
