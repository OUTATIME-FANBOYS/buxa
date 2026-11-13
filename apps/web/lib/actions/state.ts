/**
 * The result of a Server Action, as one explicit value for `useActionState`: no separate busy/error/message flags.
 * Every action returns one of these; every form reads one of these. Defined once, here.
 */
export type FieldErrors<F extends string = string> = Partial<Record<F, string>>;

export type ActionState<F extends string = string> =
  | { status: 'idle' }
  | { status: 'success'; message?: string }
  | { status: 'error'; message: string; fieldErrors?: FieldErrors<F> };

export const idle: ActionState = { status: 'idle' };
export const success = (message?: string): ActionState => ({ status: 'success', message });
export const failure = <F extends string = string>(message: string, fieldErrors?: FieldErrors<F>): ActionState<F> => ({ status: 'error', message, fieldErrors });

/** The message for one field, if that field has a problem. */
export const fieldError = <F extends string>(state: ActionState<F>, field: F): string | undefined =>
  state.status === 'error' ? state.fieldErrors?.[field] : undefined;
