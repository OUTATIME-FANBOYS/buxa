'use client';

import type { ReactNode } from 'react';
import type { Role } from '@buxa/domain';
import { WorkGate } from './WorkGate';
import type { SessionIdentity } from '@buxa/shared/kanban/actions/auth';
import { StoreProvider } from './store';
import { TaskDrawerProvider } from './TaskDrawerContext';

/**
 * The task store and drawer for every work page, acting as the signed-in person. The state lives in localStorage.
 * `drawer` is the task drawer; the screens layer passes it in so providers do not depend on components.
 */
export function WorkProviders({
  user,
  campRole = null,
  archived = false,
  children,
  drawer,
}: {
  user: SessionIdentity;
  campRole?: Role | null;
  archived?: boolean;
  children: ReactNode;
  drawer?: ReactNode;
}) {
  return (
    <StoreProvider campRole={campRole} archived={archived}>
      <TaskDrawerProvider>
        <WorkGate user={user}>
          {children}
          {drawer}
        </WorkGate>
      </TaskDrawerProvider>
    </StoreProvider>
  );
}
