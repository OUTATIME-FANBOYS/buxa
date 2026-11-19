import type { Metadata } from 'next';
import { ProjectsPage } from '@/components/views/kanban';

export const metadata: Metadata = { title: 'Projects' };

export default function Page() {
  return <ProjectsPage />;
}
