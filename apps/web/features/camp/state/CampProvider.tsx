'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Me, Membership } from '@buxa/contracts';
import { ApiError, createApi, type Api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { recalledOrg, rememberOrg } from '../lib/storage';

export type CampState =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'ready'; me: Me };

interface CampApi {
  api: Api;
  state: CampState;
  reload(): Promise<void>;
  /** The camp being worked in; null when the person has none yet. */
  current: Membership | null;
  selectOrg(orgId: string): void;
}

const CampContext = createContext<CampApi | null>(null);

export function useCamp(): CampApi {
  const value = useContext(CampContext);
  if (!value) throw new Error('useCamp must be used inside <CampProvider>');
  return value;
}

/** Loads who is signed in and which camps they belong to, and tracks which camp they are working in. */
export function CampProvider({ children }: { children: ReactNode }) {
  const { getToken, refreshToken } = useAuth();
  const api = useMemo(() => createApi({ getToken, refreshToken }), [getToken, refreshToken]);
  const [state, setState] = useState<CampState>({ status: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(recalledOrg);

  const reload = useCallback(async () => {
    try { setState({ status: 'ready', me: await api.me() }); }
    catch (error) { setState({ status: 'error', error: error instanceof ApiError ? error : new ApiError(0, 'network', 'Something went wrong.') }); }
  }, [api]);
  useEffect(() => { void reload(); }, [reload]);

  // Only ever act in a camp the person belongs to; fall back to the first one.
  const orgs = state.status === 'ready' ? state.me.orgs : [];
  const current = orgs.find(o => o.orgId === selectedId) ?? orgs[0] ?? null;
  const selectOrg = useCallback((orgId: string) => { rememberOrg(orgId); setSelectedId(orgId); }, []);

  const value = useMemo(() => ({ api, state, reload, current, selectOrg }), [api, state, reload, current, selectOrg]);
  return <CampContext.Provider value={value}>{children}</CampContext.Provider>;
}
