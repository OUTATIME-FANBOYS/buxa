import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppState } from '../types';
import { createSync, type SyncState, type Updater } from '../lib/sync';
import { createActions } from './actions';
import { loadState } from './persistence';
import { useAutosave } from './useAutosave';
import { useTheme } from './useTheme';

/** Owns the app state: one copy in React, the latest copy in a ref, optional server sync, autosave, theme. */
export function useStoreEngine() {
  const [state, setState] = useState<AppState>(loadState);
  const [sync, setSync] = useState<SyncState>('connecting');
  const [serverInfo, setServerInfo] = useState<{ mcpUrl?: string }>({});
  // The latest state, updated synchronously by every change (React's own copy lags by a render).
  const ref = useRef(state);
  const pending = useRef<Updater[]>([]);
  const engine = useRef<ReturnType<typeof createSync> | null>(null);
  const syncRef = useRef<SyncState>('connecting');

  const saveStatus = useAutosave(state);
  useTheme(state.ui.theme);

  const set = useCallback((fn: Updater) => {
    const next = fn(ref.current); if (next === ref.current) return;
    ref.current = next; setState(next);
    if (syncRef.current !== 'local') { pending.current.push(fn); engine.current?.changed(); }
  }, []);

  useEffect(() => {
    const e = createSync({
      getState: () => ref.current, commit: s => { ref.current = s; setState(s); }, pending: pending.current,
      onStatus: (s, info) => { syncRef.current = s; setSync(s); if (info) setServerInfo(info); },
    });
    engine.current = e; return () => { e.stop(); engine.current = null; };
  }, []);

  const actions = useMemo(() => createActions({ set, get: () => ref.current, replace: s => set(() => s) }), [set]);
  return { state, saveStatus, sync, serverInfo, actions };
}
