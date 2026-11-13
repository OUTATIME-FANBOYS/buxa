import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type State = { status: 'loading' } | { status: 'out' } | { status: 'in'; session: Session };
interface AuthCtx {
  state: State;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (name: string, email: string, password: string) => Promise<{ error?: string; needsConfirm?: boolean }>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
  refreshToken: () => Promise<string | null>;
}
const Ctx = createContext<AuthCtx | null>(null);
export const useAuth = () => { const c = useContext(Ctx); if (!c) throw new Error('AuthProvider missing'); return c; };

/** Messages are deliberately general: they never say whether an email has an account. */
function friendly(message: string, mode: 'in' | 'up'): string {
  if (/email not confirmed/i.test(message)) return 'Confirm your email first. Check your inbox for the link.';
  if (/invalid login|invalid credentials/i.test(message)) return 'That email and password do not match.';
  if (/password/i.test(message) && mode === 'up') return 'Choose a stronger password (at least 8 characters).';
  if (/rate|too many|limit/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
  return mode === 'in' ? 'Could not sign in. Please try again.' : 'Could not create the account. Please try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!supabase) return;
    let live = true;
    supabase.auth.getSession().then(({ data }) => { if (live) setState(data.session ? { status: 'in', session: data.session } : { status: 'out' }); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setState(session ? { status: 'in', session } : { status: 'out' }));
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, []);

  const getToken = useCallback(async () => (await supabase?.auth.getSession())?.data.session?.access_token ?? null, []);
  const refreshToken = useCallback(async () => (await supabase?.auth.refreshSession())?.data.session?.access_token ?? null, []);

  const value = useMemo<AuthCtx>(() => ({
    state, getToken, refreshToken,
    signIn: async (email, password) => {
      const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
      return error ? friendly(error.message, 'in') : null;
    },
    signUp: async (name, email, password) => {
      const { data, error } = await supabase!.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
      if (error) return { error: friendly(error.message, 'up') };
      return { needsConfirm: !data.session };
    },
    signOut: async () => { await supabase?.auth.signOut(); },
  }), [state, getToken, refreshToken]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
