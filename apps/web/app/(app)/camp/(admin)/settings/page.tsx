import type { Metadata } from 'next';
import { SettingsPage } from '@/components/views/kanban/export';

export const metadata: Metadata = { title: 'Settings' };

export default function Page() {
  return <SettingsPage />;
}
