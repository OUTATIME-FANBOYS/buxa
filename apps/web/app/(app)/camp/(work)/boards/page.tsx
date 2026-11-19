import type { Metadata } from 'next';
import { BoardsPage } from '@/components/views/kanban';

export const metadata: Metadata = { title: 'Boards' };

export default function Page() {
  return <BoardsPage />;
}
