import type { AttendanceEntry } from '@buxa/contracts';
import type { ActionOutcome } from '../actions/outcome';
import type { CheckOutRefusal } from '../lib/refusals';
import type { CheckOutResult } from '@/server/services';

/** What the person has chosen so far in one row's check-out panel. Kept across a refusal so a retry does not start again. */
export interface CheckOutDraft { collectedBy: string | null; overrideReason: string | null }

export const EMPTY_DRAFT: CheckOutDraft = { collectedBy: null, overrideReason: null };

/** One row's check-out, as one explicit state. The draft exists in every phase that is open for a decision. */
export type CheckOutState =
  | { phase: 'closed' }
  | { phase: 'open'; draft: CheckOutDraft }
  | { phase: 'submitting'; draft: CheckOutDraft }
  | { phase: 'refused'; draft: CheckOutDraft; refusal: CheckOutRefusal }
  | { phase: 'failed'; draft: CheckOutDraft; message: string }
  | { phase: 'done'; entry: AttendanceEntry };

export type CheckOutEvent =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'draft'; patch: Partial<CheckOutDraft> }
  | { type: 'submitted' }
  | { type: 'answered'; outcome: ActionOutcome<CheckOutResult> };

export const CHECK_OUT_CLOSED: CheckOutState = { phase: 'closed' };

function draftOf(state: CheckOutState): CheckOutDraft {
  return state.phase === 'open' || state.phase === 'submitting' || state.phase === 'refused' || state.phase === 'failed'
    ? state.draft
    : EMPTY_DRAFT;
}

/** Transitions. A check-out being written can only be answered; nothing else moves it. */
export function checkOutReducer(state: CheckOutState, event: CheckOutEvent): CheckOutState {
  if (state.phase === 'submitting') {
    return event.type === 'answered' ? answered(state.draft, event.outcome) : state;
  }
  switch (event.type) {
    case 'open': return state.phase === 'closed' || state.phase === 'done' ? { phase: 'open', draft: EMPTY_DRAFT } : state;
    case 'close': return CHECK_OUT_CLOSED;
    case 'draft': return state.phase === 'closed' || state.phase === 'done'
      ? state
      : { phase: 'open', draft: { ...draftOf(state), ...event.patch } };
    case 'submitted': return state.phase === 'open' || state.phase === 'refused' || state.phase === 'failed'
      ? { phase: 'submitting', draft: state.draft }
      : state;
    case 'answered': return state;
  }
}

function answered(draft: CheckOutDraft, outcome: ActionOutcome<CheckOutResult>): CheckOutState {
  if (outcome.kind !== 'ok') return { phase: 'failed', draft, message: outcome.message };
  const result = outcome.value;
  if (result.ok) return { phase: 'done', entry: result.entry };
  return { phase: 'refused', draft, refusal: result };
}
