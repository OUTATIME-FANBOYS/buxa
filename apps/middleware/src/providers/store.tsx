'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Role as CampRole } from '@buxa/domain';
import { deriveView } from '@buxa/shared';
import { useStoreEngine } from './useStoreEngine';

type Engine = ReturnType<typeof useStoreEngine>;
interface Ctx {
  engine: Engine;
  campRole: CampRole | null;
  archived: boolean;
}
const StoreCtx = createContext<Ctx | null>(null);

/**
 * `campRole` is the signed-in person's role in the camp being worked in (null when there is no camp yet).
 * `archived` makes the camp read-only for everyone, whatever the role: the same rules as a viewer.
 */
export function StoreProvider({
  campRole = null,
  archived = false,
  children,
}: {
  campRole?: CampRole | null;
  archived?: boolean;
  children: ReactNode;
}) {
  const engine = useStoreEngine();

  return <StoreCtx.Provider value={{ engine, campRole, archived }}>{children}</StoreCtx.Provider>;
}

/** The state (`s`), the actions, and everything derived from them. Memoised on the pieces that can change it. */
export function useStore() {
  const v = useContext(StoreCtx);
  if (!v) {
    throw new Error('StoreProvider missing');
  }
  const { state: s, actions, saveStatus, sync, serverInfo } = v.engine;
  const { campRole, archived } = v;

  return useMemo(() => {
    const view = deriveView(s, campRole);

    return { s, actions, saveStatus, sync, serverInfo, ...view, readOnly: archived || view.readOnly };
  }, [s, actions, saveStatus, sync, serverInfo, campRole, archived]);
}

export type { Actions } from '@buxa/shared/kanban/actions/createActions';
export type { SaveStatus } from '../store/persistence';
export { normalize } from '@buxa/shared';
