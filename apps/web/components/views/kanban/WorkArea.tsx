'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import type { Role } from '@buxa/domain';
import { TaskDrawer } from '@/components/components/kanban/drawer/export';
import type { SessionIdentity } from '@buxa/shared/kanban/actions/auth';

// The task store reads and writes localStorage and is never server-rendered, so the whole work area is client-only.
// The task drawer is composed here, in the screens layer, so the providers do not import components.
export const WorkArea = dynamic(
  () =>
    import('@buxa/middleware/providers/providers').then(m => ({
      default: ({
        user,
        campRole,
        archived,
        children,
      }: {
        user: SessionIdentity;
        campRole?: Role | null;
        archived?: boolean;
        children: ReactNode;
      }) => (
        <m.WorkProviders user={user} campRole={campRole} archived={archived} drawer={<TaskDrawer />}>
          {children}
        </m.WorkProviders>
      ),
    })),
  {
    ssr: false,
    loading: () => (
      <p className="muted" role="status" style={{ padding: 24 }}>
        Loading…
      </p>
    ),
  },
);
