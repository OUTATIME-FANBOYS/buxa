'use client';

import type { ReactNode } from 'react';
import { AppProviders } from '@buxa/middleware/providers/providers';
import { Dialog } from './Dialog';

/** The app-wide providers with this app's Dialog for confirm prompts. The middleware package takes the Dialog as a prop. */
export function AppShellProviders({ children }: { children: ReactNode }) {
  return <AppProviders Dialog={Dialog}>{children}</AppProviders>;
}
