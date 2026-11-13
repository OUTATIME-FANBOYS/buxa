'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Empty } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { useAuth } from '../auth/AuthProvider';
import { CampProvider, useCamp } from '../state/CampProvider';
import { CurrentCampContext } from '../state/CurrentCamp';
import { NewCamp } from './NewCamp';
import { Shell } from './Shell';
import { FullPageMessage } from './Status';

/** Guards the camp area: signed-out people go to sign-in; signed-in people get their camps loaded, then the page. */
export function CampGate({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();
  useEffect(() => { if (state.status === 'signed-out') router.replace(ROUTES.signIn); }, [state.status, router]);
  if (state.status !== 'signed-in') return <FullPageMessage><p className="muted">Loading…</p></FullPageMessage>;
  return <CampProvider><CampFrame>{children}</CampFrame></CampProvider>;
}

/** Waits for the camp data, then shows the app. Exactly one branch per state, so nothing can be half-loaded. */
function CampFrame({ children }: { children: ReactNode }) {
  const { state, current, reload, selectOrg } = useCamp();
  const { signOut } = useAuth();

  switch (state.status) {
    case 'loading':
      return <FullPageMessage><p className="muted">Loading…</p></FullPageMessage>;
    case 'error': {
      const expired = state.error.status === 401;
      return (
        <main className="auth"><div className="auth-card">
          <Empty icon="alert" title={expired ? 'Your session has ended' : 'Cannot reach Buxa'} body={state.error.message}
            action={<div className="row">{!expired && <button className="btn btn-primary" onClick={() => void reload()}>Try again</button>}<button className="btn" onClick={() => void signOut()}>Sign out</button></div>} />
        </div></main>
      );
    }
    case 'ready':
      return (
        <Shell user={state.me.user} orgs={state.me.orgs} current={current} onSelect={selectOrg} onSignOut={() => void signOut()}>
          {/* No camp yet: the only page is first-run setup, whatever address was asked for. */}
          {current ? <CurrentCampContext.Provider value={current}>{children}</CurrentCampContext.Provider> : <NewCamp first />}
        </Shell>
      );
  }
}
