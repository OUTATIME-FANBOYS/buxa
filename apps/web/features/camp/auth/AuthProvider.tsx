'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { describeSignInError, describeSignUpError } from './messages';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: Session };

export type AuthOutcome =
  | { outcome: 'signed-in' }
  | { outcome: 'confirm-email' }
  | { outcome: 'failed'; message: string };

interface AuthApi {
  state: AuthState;
  signIn(email: string, password: string): Promise<AuthOutcome>;
  signUp(name: string, email: string, password: string): Promise<AuthOutcome>;
  signOut(): Promise<void>;
  getToken(): Promise<string | null>;
  refreshToken(): Promise<string | null>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

const stateFor = (session: Session | null): AuthState => (session ? { status: 'signed-in', session } : { status: 'signed-out' });

/** Wraps Supabase Auth. It takes a ready client, so there is no "not configured" state to handle in here. */
export function AuthProvider({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    void client.auth.getSession().then(({ data }) => { if (active) setState(stateFor(data.session)); });
    const { data } = client.auth.onAuthStateChange((_event, session) => setState(stateFor(session)));
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [client]);

  const getToken = useCallback(async () => (await client.auth.getSession()).data.session?.access_token ?? null, [client]);
  const refreshToken = useCallback(async () => (await client.auth.refreshSession()).data.session?.access_token ?? null, [client]);

  const api = useMemo<AuthApi>(() => ({
    state, getToken, refreshToken,
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      return error ? { outcome: 'failed', message: describeSignInError(error.message) } : { outcome: 'signed-in' };
    },
    async signUp(name, email, password) {
      const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
      if (error) return { outcome: 'failed', message: describeSignUpError(error.message) };
      return data.session ? { outcome: 'signed-in' } : { outcome: 'confirm-email' };
    },
    async signOut() { await client.auth.signOut(); },
  }), [client, state, getToken, refreshToken]);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}
