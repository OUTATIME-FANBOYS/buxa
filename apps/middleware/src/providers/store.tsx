'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Role as CampRole } from '@buxa/domain';
import { deriveView } from '@buxa/shared';
import { useStoreEngine } from './useStoreEngine';

type Engine = ReturnType<typeof useStoreEngine>;
interface Ctx { engine: Engine; campRole: CampRole | null }
const StoreCtx = createContext<Ctx | null>(null);

/** `campRole` is the signed-in person's role in the camp being worked in (null when there is no camp yet). */
export function StoreProvider({ campRole = null, children }: { campRole?: CampRole | null; children: ReactNode }) {
  const engine = useStoreEngine();

  return <StoreCtx.Provider value={{ engine, campRole }}>{children}</StoreCtx.Provider>;
}

/** The state (`s`), the actions, and everything derived from them. Memoised on the pieces that can change it. */
export function useStore() {
  const v = useContext(StoreCtx); if (!v) {
    throw new Error('StoreProvider missing');
  }
  const { state: s, actions, saveStatus, sync, serverInfo } = v.engine;
  const { campRole } = v;

  return useMemo(() => ({ s, actions, saveStatus, sync, serverInfo, ...deriveView(s, campRole) }), [s, actions, saveStatus, sync, serverInfo, campRole]);
}

export type { Actions } from '@buxa/shared/kanban/actions/createActions';
export type { SaveStatus } from '../store/persistence';
export { normalize } from '@buxa/shared';
