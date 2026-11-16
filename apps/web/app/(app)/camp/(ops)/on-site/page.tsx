import type { Metadata } from 'next';
import { OnSiteScreen } from '@/screens';

export const metadata: Metadata = { title: 'On site' };

export default function Page() {
  return <OnSiteScreen />;
}
