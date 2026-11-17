'use client';

import type { ReactNode } from 'react';
import { WorkGate } from './WorkGate';
import type { SessionIdentity } from '@buxa/server/composers/index';
import { StoreProvider } from './store';
import { TaskDrawerProvider } from './TaskDrawerContext';

/**
 * The task store and drawer for every work page, acting as the signed-in person. The state lives in localStorage.
 * `drawer` is the task drawer; the screens layer passes it in so providers do not depend on components.
 */
export function WorkProviders({ user, children, drawer }: { user: SessionIdentity; children: ReactNode; drawer?: ReactNode }) {
  return (
    <StoreProvider>
      <TaskDrawerProvider>
        <WorkGate user={user}>
          {children}
          {drawer}
        </WorkGate>
      </TaskDrawerProvider>
    </StoreProvider>
  );
}
