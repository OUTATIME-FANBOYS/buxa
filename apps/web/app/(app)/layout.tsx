import type { ReactNode } from 'react';
import { AppProviders } from '@/providers/AppProviders';

/** Everything signed-in or about to be: sign-in and the camp area share one set of providers. */
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
