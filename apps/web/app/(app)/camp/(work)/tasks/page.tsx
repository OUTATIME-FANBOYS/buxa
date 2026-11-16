import type { Metadata } from 'next';
import { TasksPage } from '@/features/kanban/pages';

export const metadata: Metadata = { title: 'My tasks' };

export default function Page() {
  return <TasksPage />;
}
