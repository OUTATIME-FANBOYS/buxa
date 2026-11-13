import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, createApi, type Api, type Me, type Membership } from './api';
import { useAuth } from './auth';
import { recalledOrg, rememberOrg } from './lib';

type State = { status: 'loading' } | { status: 'error'; error: ApiError } | { status: 'ready'; me: Me };
interface CampCtx {
  api: Api; state: State; reload: () => Promise<void>;
  /** The camp being worked in; null when the person has none yet. */
  current: Membership | null; selectOrg: (id: string) => void;
}
const Ctx = createContext<CampCtx | null>(null);
export const useCamp = () => { const c = useContext(Ctx); if (!c) throw new Error('CampProvider missing'); return c; };

export function CampProvider({ children }: { children: ReactNode }) {
  const { getToken, refreshToken } = useAuth();
  const api = useMemo(() => createApi({ getToken, refreshToken }), [getToken, refreshToken]);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [orgId, setOrgId] = useState<string | null>(recalledOrg);

  const reload = useCallback(async () => {
    try { setState({ status: 'ready', me: await api.me() }); }
    catch (e) { setState({ status: 'error', error: e instanceof ApiError ? e : new ApiError(0, 'network', 'Something went wrong.') }); }
  }, [api]);
  useEffect(() => { void reload(); }, [reload]);

  const orgs = state.status === 'ready' ? state.me.orgs : [];
  // Only ever act in a camp the person belongs to; fall back to the first one.
  const current = orgs.find(o => o.orgId === orgId) ?? orgs[0] ?? null;
  const selectOrg = useCallback((id: string) => { rememberOrg(id); setOrgId(id); }, []);

  return <Ctx.Provider value={{ api, state, reload, current, selectOrg }}>{children}</Ctx.Provider>;
}
