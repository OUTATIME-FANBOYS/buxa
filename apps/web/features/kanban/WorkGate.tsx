'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { ROUTES } from '@/config/routes';
import { useStore } from './state/store';

/**
 * Work pages need a demo account chosen in this browser. Without one: a person with a real session gets the first demo account,
 * and anyone else is sent to sign-in, where the demo accounts are offered.
 */
export function WorkGate({ realSession, children }: { realSession: boolean; children: ReactNode }) {
  const router = useRouter();
  const { s, actions } = useStore();
  const userId = s.session.userId;
  const firstDemo = s.users.find(u => s.accounts.some(a => a.userId === u.id && a.demo))?.id;

  useEffect(() => {
    if (userId) return;
    if (realSession && firstDemo) { actions.switchUser(firstDemo); return; }
    if (!realSession) router.replace(ROUTES.signIn);
  }, [userId, realSession, firstDemo, actions, router]);

  if (!userId) return <p className="muted" role="status" style={{ padding: 24 }}>Loading…</p>;
  return <>{children}</>;
}
