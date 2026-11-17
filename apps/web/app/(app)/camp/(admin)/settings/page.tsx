import type { Metadata } from 'next';
import { SettingsPage } from '@/views';

export const metadata: Metadata = { title: 'Settings' };

export default function Page() {
  return <SettingsPage />;
}
