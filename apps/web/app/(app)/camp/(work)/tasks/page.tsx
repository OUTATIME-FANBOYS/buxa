import type { Metadata } from 'next';
import { TasksPage } from '@/views/export';

export const metadata: Metadata = { title: 'My tasks' };

export default function Page() {
  return <TasksPage />;
}
