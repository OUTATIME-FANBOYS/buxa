'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/** Which task the drawer shows: an existing id, or `'new'` with optional starting values. */
export interface TaskDrawerState { id: string | 'new'; defaults?: { columnId?: string; due?: string; projectId?: string } }

interface TaskDrawerCtx {
  drawer: TaskDrawerState | null;
  openTask: (id: TaskDrawerState['id'], defaults?: TaskDrawerState['defaults']) => void;
  closeTask: () => void;
}
const Ctx = createContext<TaskDrawerCtx | null>(null);

export const useTaskDrawer = () => { const c = useContext(Ctx); if (!c) throw new Error('TaskDrawerProvider missing'); return c; };

export function TaskDrawerProvider({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState<TaskDrawerState | null>(null);
  const openTask = useCallback<TaskDrawerCtx['openTask']>((id, defaults) => setDrawer({ id, defaults }), []);
  const closeTask = useCallback(() => setDrawer(null), []);
  const value = useMemo(() => ({ drawer, openTask, closeTask }), [drawer, openTask, closeTask]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
