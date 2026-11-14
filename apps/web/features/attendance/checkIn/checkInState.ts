import type { AttendanceEntry, CheckInMethod } from '@buxa/contracts';
import type { ActionOutcome } from '../actions/outcome';
import type { PersonCard, Lookup } from '../lib/card';
import type { CheckInRefusal } from '../lib/refusals';
import type { CheckInResult } from '@/server/services';

/**
 * The check-in screen as one explicit state. Exactly one phase at a time; the card, method and refusal exist only in the phases that
 * need them, so a half-filled state cannot be written.
 */
export type CheckInState =
  | { phase: 'idle' }
  | { phase: 'unknown' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; card: PersonCard; method: CheckInMethod }
  | { phase: 'submitting'; card: PersonCard; method: CheckInMethod }
  | { phase: 'refused'; card: PersonCard; method: CheckInMethod; refusal: CheckInRefusal }
  | { phase: 'failed'; card: PersonCard; method: CheckInMethod; message: string }
  | { phase: 'done'; card: PersonCard; entry: AttendanceEntry; overridden: boolean };

export type CheckInEvent =
  | { type: 'unknown' }
  | { type: 'error'; message: string }
  | { type: 'selected'; card: PersonCard; method: CheckInMethod }
  | { type: 'submitted' }
  | { type: 'answered'; outcome: ActionOutcome<CheckInResult> }
  | { type: 'reset' };

export const CHECK_IN_IDLE: CheckInState = { phase: 'idle' };

/** Maps a lookup answer (a scan) to the event that shows it. */
export const lookupEvent = (lookup: Lookup, method: CheckInMethod): CheckInEvent =>
  lookup.kind === 'unknown' ? { type: 'unknown' } : { type: 'selected', card: lookup.card, method };

/** Transitions. While a check-in is being written, only its answer may move the screen. */
export function checkInReducer(state: CheckInState, event: CheckInEvent): CheckInState {
  if (state.phase === 'submitting') return event.type === 'answered' ? answered(state, event.outcome) : state;
  switch (event.type) {
    case 'unknown': return { phase: 'unknown' };
    case 'error': return { phase: 'error', message: event.message };
    case 'selected': return { phase: 'ready', card: event.card, method: event.method };
    case 'reset': return CHECK_IN_IDLE;
    case 'submitted': return submit(state);
    case 'answered': return state;
  }
}

function submit(state: CheckInState): CheckInState {
  if (state.phase === 'ready' || state.phase === 'refused' || state.phase === 'failed') {
    return { phase: 'submitting', card: state.card, method: state.method };
  }
  return state;
}

function answered(state: Extract<CheckInState, { phase: 'submitting' }>, outcome: ActionOutcome<CheckInResult>): CheckInState {
  if (outcome.kind !== 'ok') return { phase: 'failed', card: state.card, method: state.method, message: outcome.message };
  const result = outcome.value;
  if (result.ok) return { phase: 'done', card: state.card, entry: result.entry, overridden: result.overridden };
  return { phase: 'refused', card: state.card, method: state.method, refusal: result };
}
