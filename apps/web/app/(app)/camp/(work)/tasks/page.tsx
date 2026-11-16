import type { Metadata } from 'next';
import { TasksPage } from '@/screens';

export const metadata: Metadata = { title: 'My tasks' };

export default function Page() {
  return <TasksPage />;
}
