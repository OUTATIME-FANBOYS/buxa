import type { Metadata } from 'next';
import { ProjectsPage } from '@/screens';

export const metadata: Metadata = { title: 'Projects' };

export default function Page() {
  return <ProjectsPage />;
}
