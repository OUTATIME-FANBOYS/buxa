'use client';

import { useCallback, useEffect, useReducer } from 'react';
import type { CheckInMethod } from '@buxa/contracts';
import { checkInAction } from '../actions/checkIn';
import { scanCodeAction } from '../actions/scanCode';
import type { PersonCard } from '../lib/card';
import { CHECK_IN_IDLE, checkInReducer, lookupEvent } from './checkInState';

/** How long the confirmation stays before the screen clears for the next person. */
export const CONFIRM_MS = 2000;

/** The check-in screen's state and its three ways in: a code, a picked name, and the Check in action. */
export function useCheckIn() {
  const [state, dispatch] = useReducer(checkInReducer, CHECK_IN_IDLE);
  const phase = state.phase;

  useEffect(() => {
    if (phase !== 'done') return undefined;
    const timer = window.setTimeout(() => dispatch({ type: 'reset' }), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const scanCode = useCallback(async (raw: string) => {
    const outcome = await scanCodeAction({ raw });
    dispatch(outcome.kind === 'ok' ? lookupEvent(outcome.value, 'qr') : { type: 'error', message: outcome.message });
  }, []);

  const pickPerson = useCallback((card: PersonCard) => dispatch({ type: 'selected', card, method: 'search' }), []);

  const checkIn = useCallback(async (card: PersonCard, method: CheckInMethod, overrideReason?: string) => {
    dispatch({ type: 'submitted' });
    const outcome = await checkInAction({
      personId: card.person.id, method, ...(overrideReason ? { overrideReason } : {}),
    });
    dispatch({ type: 'answered', outcome });
  }, []);

  const clear = useCallback(() => dispatch({ type: 'reset' }), []);

  return { state, scanCode, pickPerson, checkIn, clear };
}
