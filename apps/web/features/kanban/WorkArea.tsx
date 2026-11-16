'use client';

import dynamic from 'next/dynamic';

// The task store reads and writes localStorage and is never server-rendered, so the whole work area is client-only.
export const WorkArea = dynamic(() => import('./WorkProviders'), {
  ssr: false,
  loading: () => <p className="muted" role="status" style={{ padding: 24 }}>Loading…</p>,
});
