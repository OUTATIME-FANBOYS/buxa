'use client';

import dynamic from 'next/dynamic';

// The original kanban demo keeps its state and routing in the browser (localStorage and #/ routes), so it is never server-rendered.
export const KanbanApp = dynamic(() => import('./KanbanRoot'), {
  ssr: false,
  loading: () => <p className="muted" role="status" style={{ padding: 24 }}>Loading…</p>,
});
