'use client';

import type { ReactNode } from 'react';
import { AppProviders } from '@buxa/middleware/providers/providers';
import { ConfirmDialog } from './ConfirmDialog';

/** The app-wide providers with this app's ConfirmDialog for confirm prompts. The middleware package takes it as a prop. */
export function AppShellProviders({ children }: { children: ReactNode }) {
  return <AppProviders Dialog={ConfirmDialog}>{children}</AppProviders>;
}
