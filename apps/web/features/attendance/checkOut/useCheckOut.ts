'use client';

import { useCallback, useReducer } from 'react';
import { checkOutAction } from '../actions/checkOut';
import { checkOutInputFor } from './checkOutInput';
import { CHECK_OUT_CLOSED, checkOutReducer, type CheckOutDraft } from './checkOutState';

/** One on-site row's check-out panel: its state and the three things a person does in it. */
export function useCheckOut(personId: string) {
  const [state, dispatch] = useReducer(checkOutReducer, CHECK_OUT_CLOSED);

  const open = useCallback(() => dispatch({ type: 'open' }), []);
  const close = useCallback(() => dispatch({ type: 'close' }), []);
  const patch = useCallback((change: Partial<CheckOutDraft>) => dispatch({ type: 'draft', patch: change }), []);

  const submit = useCallback(async (draft: CheckOutDraft) => {
    dispatch({ type: 'submitted' });
    const outcome = await checkOutAction(checkOutInputFor(personId, draft));
    dispatch({ type: 'answered', outcome });
  }, [personId]);

  return { state, open, close, patch, submit };
}
