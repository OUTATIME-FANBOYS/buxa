'use client';

import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { ApiError } from '../api/client';

export type Load<T> =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'ready'; data: T };

/** Loads data when `deps` change. Results from a superseded load are dropped, so a slow old request cannot overwrite a newer one. */
export function useLoad<T>(load: () => Promise<T>, deps: DependencyList): Load<T> & { retry: () => void } {
  const [state, setState] = useState<Load<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(load);
  latest.current = load;

  useEffect(() => {
    let current = true;
    setState({ status: 'loading' });
    latest.current().then(
      data => { if (current) setState({ status: 'ready', data }); },
      error => { if (current) setState({ status: 'error', error: error instanceof ApiError ? error : new ApiError(0, 'network', 'Something went wrong.') }); },
    );
    return () => { current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller's list; `load` is read through a ref
  }, [attempt, ...deps]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);
  return { ...state, retry };
}
