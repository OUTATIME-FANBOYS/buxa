import type { Metadata } from 'next';
import { BoardsPage } from '@/screens';

export const metadata: Metadata = { title: 'Boards' };

export default function Page() {
  return <BoardsPage />;
}
