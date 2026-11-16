import type { Metadata } from 'next';
import { BoardsPage } from '@/views/export';

export const metadata: Metadata = { title: 'Boards' };

export default function Page() {
  return <BoardsPage />;
}
