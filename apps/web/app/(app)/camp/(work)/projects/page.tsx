import type { Metadata } from 'next';
import { ProjectsPage } from '@/features/kanban/pages';

export const metadata: Metadata = { title: 'Projects' };

export default function Page() {
  return <ProjectsPage />;
}
