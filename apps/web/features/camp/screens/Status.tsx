import type { ReactNode } from 'react';
import { Empty } from '@/components/ui';
import type { ApiError } from '../api/client';

/** A centred message on the sign-in backdrop, for the moments before the app shell exists. */
export function FullPageMessage({ children }: { children: ReactNode }) {
  return <main className="auth"><div className="auth-card" aria-busy="true" role="status">{children}</div></main>;
}

export function Loading({ what }: { what: string }) {
  return <div className="page" aria-busy="true" role="status"><p className="muted">Loading {what}…</p></div>;
}

export function Problem({ error, retry }: { error: ApiError; retry: () => void }) {
  return (
    <div className="page">
      <Empty icon="alert" title={error.status === 403 ? 'No access' : 'Could not load this'} body={error.message} action={<button className="btn" onClick={retry}>Try again</button>} />
    </div>
  );
}
