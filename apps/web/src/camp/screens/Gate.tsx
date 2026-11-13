import { Empty } from '../../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { useCamp } from '../state/CampProvider';
import { CampPages } from './CampPages';
import { Shell } from './Shell';
import { FullPageMessage } from './Status';

/** Waits for the camp data, then shows the app. Exactly one branch per state, so nothing can be half-loaded. */
export function Gate() {
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
          <CampPages camp={current} />
        </Shell>
      );
  }
}
