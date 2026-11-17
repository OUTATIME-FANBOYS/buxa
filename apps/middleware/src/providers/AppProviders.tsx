'use client';

import type { ComponentType, ReactNode } from 'react';
import { UiProvider, type ConfirmDialogProps } from './UiProvider';

/**
 * The one place app-wide client providers are stacked: toasts, confirm dialogs and the small-screen sidebar. `Dialog` is the
 * web app's dialog component, passed in so providers do not depend on components.
 */
export function AppProviders({ children, Dialog }: { children: ReactNode; Dialog: ComponentType<ConfirmDialogProps> }) {
  return <UiProvider Dialog={Dialog}>{children}</UiProvider>;
}
