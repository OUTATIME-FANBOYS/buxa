'use client';

import type { ReactNode } from 'react';
import { UiProvider } from '@/components/ui';

/** The one place app-wide client providers are stacked: toasts, confirm dialogs and the small-screen sidebar. */
export function AppProviders({ children }: { children: ReactNode }) {
  return <UiProvider>{children}</UiProvider>;
}
