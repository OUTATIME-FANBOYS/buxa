'use client';

import { useEffect, type ReactNode } from 'react';
import type { SessionIdentity } from '../../logic/composers';
import { useStore } from './state/store';

/**
 * The work pages act as the signed-in person. Until the board has adopted that person as its current user, nothing renders.
 * The server layout has already sent anyone without a session to sign-in, so there is no signed-out state here.
 */
export function WorkGate({ user, children }: { user: SessionIdentity; children: ReactNode }) {
  const { s, actions } = useStore();
  const { id, name, email } = user;
  const ready = s.session.userId === id;

  useEffect(() => {
    if (!ready) actions.adoptSessionUser({ id, name, email });
  }, [ready, id, name, email, actions]);

  if (!ready) return <p className="muted" role="status" style={{ padding: 24 }}>Loading…</p>;
  return <>{children}</>;
}
