'use client';

import dynamic from 'next/dynamic';

// The original kanban demo keeps its state and routing in the browser (localStorage and #/ routes), so it is never server-rendered.
const KanbanApp = dynamic(() => import('@/features/kanban/App'), { ssr: false, loading: () => <p className="muted" role="status" style={{ padding: 24 }}>Loading…</p> });

export default function KanbanPage() {
  return <KanbanApp />;
}
