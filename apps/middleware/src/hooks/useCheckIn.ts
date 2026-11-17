'use client';

import { useCallback, useEffect, useReducer } from 'react';
import type { CheckInMethod } from '@buxa/contracts';
import type { ActionOutcome, CheckInResult, Lookup, PersonCard } from '@buxa/shared';
import { CHECK_IN_IDLE, checkInReducer, lookupEvent } from '@buxa/shared';

/** How long the confirmation stays before the screen clears for the next person. */
export const CONFIRM_MS = 2000;

/** The server actions the check-in screen calls. The web app passes them in, so this package never imports the server. */
export interface CheckInActions {
  checkIn(input: unknown): Promise<ActionOutcome<CheckInResult>>;
  scanCode(input: unknown): Promise<ActionOutcome<Lookup>>;
}

/** The check-in screen's state and its three ways in: a code, a picked name, and the Check in action. */
export function useCheckIn(actions: CheckInActions) {
  const [state, dispatch] = useReducer(checkInReducer, CHECK_IN_IDLE);
  const phase = state.phase;

  useEffect(() => {
    if (phase !== 'done') {
      return undefined;
    }
    const timer = window.setTimeout(() => dispatch({ type: 'reset' }), CONFIRM_MS);

    return () => window.clearTimeout(timer);
  }, [phase]);

  const scanCode = useCallback(async (raw: string) => {
    const outcome = await actions.scanCode({ raw });
    dispatch(outcome.kind === 'ok' ? lookupEvent(outcome.value, 'qr') : { type: 'error', message: outcome.message });
  }, [actions]);

  const pickPerson = useCallback((card: PersonCard) => dispatch({ type: 'selected', card, method: 'search' }), []);

  const checkIn = useCallback(async (card: PersonCard, method: CheckInMethod, overrideReason?: string) => {
    dispatch({ type: 'submitted' });
    const outcome = await actions.checkIn({
      personId: card.person.id, method, ...(overrideReason ? { overrideReason } : {}),
    });
    dispatch({ type: 'answered', outcome });
  }, [actions]);

  const clear = useCallback(() => dispatch({ type: 'reset' }), []);

  return { state, scanCode, pickPerson, checkIn, clear };
}
