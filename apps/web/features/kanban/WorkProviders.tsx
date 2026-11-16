'use client';

import type { ReactNode } from 'react';
import { TaskDrawer } from './components/drawer/TaskDrawer';
import { WorkGate } from './WorkGate';
import { StoreProvider } from './state/store';
import { TaskDrawerProvider } from './state/TaskDrawerContext';

/** The task store and drawer for every work page. Browser-only: the state lives in localStorage. */
export default function WorkProviders({ realSession, children }: { realSession: boolean; children: ReactNode }) {
  return (
    <StoreProvider>
      <TaskDrawerProvider>
        <WorkGate realSession={realSession}>
          {children}
          <TaskDrawer />
        </WorkGate>
      </TaskDrawerProvider>
    </StoreProvider>
  );
}
