import { useEffect, useRef, useState } from 'react';
import type { AppState } from '../types';
import { storage, type SaveStatus } from './persistence';

/** Saves the state shortly after it stops changing and reports whether the save worked. The first render is not a change. */
export function useAutosave(state: AppState): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setStatus('saving');
    const id = setTimeout(() => { try { storage.save(state); setStatus('saved'); } catch { setStatus('error'); } }, 250);
    return () => clearTimeout(id);
  }, [state]);
  return status;
}
