/**
 * @deprecated Retired by `ActionState` (lib/actions/state.ts). Kept only because the old screens (rewritten by B1/A1) still import it;
 * the integrator deletes it together with them.
 *
 * The life of one form submission, as an explicit state machine instead of separate busy/error/note flags.
 * Every state is one value; every way of moving between them is listed in `submissionReducer`.
 *
 *   editing ──submit──▶ submitting ──succeeded──▶ succeeded
 *      ▲  ▲                 │  └──failed──▶ failed ──edit/submit──▶ editing/submitting
 *      │  └───invalid───────┘ (server rejected a field)
 *      └──invalid (client validation)
 */
export type FieldErrors<F extends string> = Partial<Record<F, string>>;

export type Submission<F extends string> =
  | { status: 'editing'; errors: FieldErrors<F> }
  | { status: 'submitting' }
  | { status: 'failed'; message: string }
  | { status: 'succeeded'; message?: string };

export type SubmissionAction<F extends string> =
  | { type: 'edit' }
  | { type: 'submit' }
  | { type: 'invalid'; errors: FieldErrors<F> }
  | { type: 'failed'; message: string }
  | { type: 'succeeded'; message?: string }
  | { type: 'reset' };

export const editing = <F extends string>(errors: FieldErrors<F> = {}): Submission<F> => ({ status: 'editing', errors });
export const hasErrors = (errors: object): boolean => Object.keys(errors).length > 0;

/** Actions that do not apply in the current state are ignored, which is what stops a double submit. */
export function submissionReducer<F extends string>(state: Submission<F>, action: SubmissionAction<F>): Submission<F> {
  switch (state.status) {
    case 'editing':
      if (action.type === 'submit') return { status: 'submitting' };
      if (action.type === 'invalid') return editing(action.errors);
      return state;
    case 'submitting':
      if (action.type === 'succeeded') return { status: 'succeeded', message: action.message };
      if (action.type === 'failed') return { status: 'failed', message: action.message };
      if (action.type === 'invalid') return editing(action.errors); // the server rejected a specific field
      return state;
    case 'failed':
      if (action.type === 'submit') return { status: 'submitting' };
      if (action.type === 'edit' || action.type === 'reset') return editing();
      if (action.type === 'invalid') return editing(action.errors);
      return state;
    case 'succeeded':
      return action.type === 'reset' ? editing() : state;
  }
}
