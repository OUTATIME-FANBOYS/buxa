'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { AppState } from '@buxa/shared';
import { createActions } from '@buxa/shared/kanban/actions/createActions';
import { loadState } from '../store/persistence';
import { useAutosave } from './useAutosave';
import { useTheme } from './useTheme';

/** Owns the app state: one copy in React, the latest copy in a ref, autosave, theme. The board is kept in this browser. */
export function useStoreEngine() {
  const [state, setState] = useState<AppState>(loadState);
  // The latest state, updated synchronously by every change (React's own copy lags by a render).
  const ref = useRef(state);

  const saveStatus = useAutosave(state);
  useTheme(state.ui.theme);

  const set = useCallback((fn: (s: AppState) => AppState) => {
    const next = fn(ref.current); if (next === ref.current) return;
    ref.current = next; setState(next);
  }, []);

  const actions = useMemo(() => createActions({ set, get: () => ref.current, replace: s => set(() => s) }), [set]);
  return { state, saveStatus, actions };
}
