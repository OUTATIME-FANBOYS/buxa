import type { Metadata } from 'next';
import { ProjectsPage } from '@/views';

export const metadata: Metadata = { title: 'Projects' };

export default function Page() {
  return <ProjectsPage />;
}
