/**
 * The steps a family (at the gate) or staff (at the desk) go through to verify a code: the email, then the code. A discriminated union
 * with one reducer, so the screen can only be in one step at a time (CODING_STANDARDS section 4).
 */
export type EntryState =
  | { step: 'email'; busy: boolean; message: string | null }
  | { step: 'code'; email: string; busy: boolean; message: string | null }
  | { step: 'verified' };

export type EntryEvent =
  | { type: 'emailSubmitted' }
  | { type: 'codeRequested'; email: string; message: string }
  | { type: 'requestFailed'; message: string }
  | { type: 'codeSubmitted' }
  | { type: 'codeRefused'; message: string }
  | { type: 'codeVerified' }
  | { type: 'emailChanged' };

export const initialEntryState: EntryState = { step: 'email', busy: false, message: null };

/** The next state. An event that does not fit the current step changes nothing. */
export function entryReducer(state: EntryState, event: EntryEvent): EntryState {
  switch (event.type) {
    case 'emailSubmitted':
      return state.step === 'email' ? { ...state, busy: true, message: null } : state;
    case 'codeRequested':
      // The answer is the same for a known and an unknown email, so it is shown as it is, and the code step always follows.
      return state.step === 'email' || state.step === 'code'
        ? { step: 'code', email: event.email, busy: false, message: event.message }
        : state;
    case 'requestFailed':
      return state.step === 'email' ? { step: 'email', busy: false, message: event.message } : state;
    case 'codeSubmitted':
      return state.step === 'code' ? { ...state, busy: true, message: null } : state;
    case 'codeRefused':
      return state.step === 'code' ? { ...state, busy: false, message: event.message } : state;
    case 'codeVerified':
      return state.step === 'code' ? { step: 'verified' } : state;
    case 'emailChanged':
      return state.step === 'code' ? initialEntryState : state;
  }
}
