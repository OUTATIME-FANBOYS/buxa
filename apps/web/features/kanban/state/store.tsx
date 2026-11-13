import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { deriveView } from './derive';
import { useStoreEngine } from './useStoreEngine';

type Engine = ReturnType<typeof useStoreEngine>;
const Ctx = createContext<Engine | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const v = useStoreEngine();
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

/** The state (`s`), the actions, and everything derived from them. Memoised on the pieces that can change it. */
export function useStore() {
  const v = useContext(Ctx); if (!v) throw new Error('StoreProvider missing');
  const { state: s, actions, saveStatus, sync, serverInfo } = v;
  return useMemo(() => ({ s, actions, saveStatus, sync, serverInfo, ...deriveView(s) }), [s, actions, saveStatus, sync, serverInfo]);
}

export type { Actions } from './actions';
export type { SaveStatus } from './persistence';
export { normalize } from './normalize';
