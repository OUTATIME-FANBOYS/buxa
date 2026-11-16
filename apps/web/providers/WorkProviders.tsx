'use client';

import type { ReactNode } from 'react';
import { TaskDrawer } from '@/components';
import { WorkGate } from './WorkGate';
import type { SessionIdentity } from '@/logic/composers';
import { StoreProvider } from '@/components';
import { TaskDrawerProvider } from '@/components';

/** The task store and drawer for every work page, acting as the signed-in person. The state lives in localStorage. */
export function WorkProviders({ user, children }: { user: SessionIdentity; children: ReactNode }) {
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
