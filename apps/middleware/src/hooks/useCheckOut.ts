'use client';

import { useCallback, useReducer } from 'react';
import type { CheckOutInput } from '@buxa/contracts';
import { checkOutInputFor } from '@buxa/shared';
import { CHECK_OUT_CLOSED, checkOutReducer, type CheckOutDraft } from '@buxa/shared';
import type { ActionOutcome, CheckOutResult } from '@buxa/shared';

/** The server action a check-out panel calls. The web app passes it in, so this package never imports the server. */
export interface CheckOutActions {
  checkOut(input: CheckOutInput): Promise<ActionOutcome<CheckOutResult>>;
}

/** One on-site row's check-out panel: its state and the three things a person does in it. */
export function useCheckOut(personId: string, actions: CheckOutActions) {
  const [state, dispatch] = useReducer(checkOutReducer, CHECK_OUT_CLOSED);

  const open = useCallback(() => dispatch({ type: 'open' }), []);
  const close = useCallback(() => dispatch({ type: 'close' }), []);
  const patch = useCallback((change: Partial<CheckOutDraft>) => dispatch({ type: 'draft', patch: change }), []);

  const submit = useCallback(
    async (draft: CheckOutDraft) => {
      dispatch({ type: 'submitted' });
      const outcome = await actions.checkOut(checkOutInputFor(personId, draft));
      dispatch({ type: 'answered', outcome });
    },
    [personId, actions],
  );

  return { state, open, close, patch, submit };
}
