'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { TaskDrawer } from '@/components';
import type { SessionIdentity } from '@buxa/shared/kanban/actions/auth';

// The task store reads and writes localStorage and is never server-rendered, so the whole work area is client-only.
// The task drawer is composed here, in the screens layer, so the providers do not import components.
export const WorkArea = dynamic(
  () => import('@buxa/middleware/providers/providers').then((m) => ({
    default: ({ user, children }: { user: SessionIdentity; children: ReactNode }) => (
      <m.WorkProviders user={user} drawer={<TaskDrawer />}>{children}</m.WorkProviders>
    ),
  })),
  {
    ssr: false,
    loading: () => <p className="muted" role="status" style={{ padding: 24 }}>Loading…</p>,
  },
);
