'use client';

import type { ReactNode } from 'react';
import { TaskDrawer } from './components/drawer/TaskDrawer';
import { WorkGate } from './WorkGate';
import type { SessionIdentity } from './state/actions/auth';
import { StoreProvider } from './state/store';
import { TaskDrawerProvider } from './state/TaskDrawerContext';

/** The task store and drawer for every work page, acting as the signed-in person. The state lives in localStorage. */
export default function WorkProviders({ user, children }: { user: SessionIdentity; children: ReactNode }) {
  return (
    <StoreProvider>
      <TaskDrawerProvider>
        <WorkGate user={user}>
          {children}
          <TaskDrawer />
        </WorkGate>
      </TaskDrawerProvider>
    </StoreProvider>
  );
}
