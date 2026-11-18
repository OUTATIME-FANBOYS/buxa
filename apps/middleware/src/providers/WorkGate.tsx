'use client';

import { useEffect, type ReactNode } from 'react';
import type { SessionIdentity } from '@buxa/shared/kanban/actions/auth';
import { useStore } from './store';

/**
 * The work pages act as the signed-in person. Until the board has adopted that person as its current user, nothing renders.
 * The server layout has already sent anyone without a session to sign-in, so there is no signed-out state here.
 */
export function WorkGate({ user, children }: { user: SessionIdentity; children: ReactNode }) {
  const { s, actions } = useStore();
  const { id, name, email } = user;
  const ready = s.session.userId === id;
  // The board's copy of the person follows the account: when a saved name changes it, the board takes the new one too.
  const record = s.users.find(u => u.id === id);
  const stale = record?.name !== name || record?.email !== email;

  useEffect(() => {
    if (!ready || stale) {
      actions.adoptSessionUser({ id, name, email });
    }
  }, [ready, stale, id, name, email, actions]);

  if (!ready) {
    return (
      <p className="muted" role="status" style={{ padding: 24 }}>
        Loading…
      </p>
    );
  }

  return <>{children}</>;
}
