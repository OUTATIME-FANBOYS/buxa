import { UiProvider } from '../../components/ui';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabase';
import { CampProvider } from '../state/CampProvider';
import { Gate } from './Gate';
import { NotConfigured } from './NotConfigured';
import { SignIn } from './SignIn';
import { FullPageMessage } from './Status';

function AuthGate() {
  const { state } = useAuth();
  switch (state.status) {
    case 'loading': return <FullPageMessage><p className="muted">Loading…</p></FullPageMessage>;
    case 'signed-out': return <SignIn />;
    case 'signed-in': return <CampProvider><Gate /></CampProvider>;
  }
}

/** The camp area: sign in, then the camps the person belongs to. */
export function CampApp() {
  if (!supabase) return <NotConfigured />;
  return <AuthProvider client={supabase}><UiProvider><AuthGate /></UiProvider></AuthProvider>;
}
