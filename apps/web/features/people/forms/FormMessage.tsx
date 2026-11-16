'use client';

import { useEffect, useRef } from 'react';
import type { ActionState } from '@/lib/actions/state';

/**
 * A form-level result. It takes focus when a result arrives (success, or an error with no field to point at), so a keyboard user and
 * a screen reader both land on what happened. Field errors are handled by the form, which focuses the first invalid field.
 */
export function FormMessage({ state }: { state: ActionState }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const focusable = state.status === 'success' || (state.status === 'error' && !state.fieldErrors);
  useEffect(() => { if (focusable) ref.current?.focus(); }, [state, focusable]);

  if (state.status === 'idle') return null;
  if (state.status === 'success') {
    return state.message ? <p ref={ref} tabIndex={-1} role="status" className="people-message people-message-ok">{state.message}</p> : null;
  }
  return <p ref={ref} tabIndex={-1} role="alert" className="field-error">{state.message}</p>;
}
