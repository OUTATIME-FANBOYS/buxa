import type { ReactNode } from 'react';
import { AppShellProviders } from '@/components/components/export';

/** Everything signed-in or about to be: sign-in and the camp area share one set of providers. */
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <AppShellProviders>{children}</AppShellProviders>;
}
