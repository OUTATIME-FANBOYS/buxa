import type { ActionState } from '@buxa/shared';

/**
 * A form-level error, announced to screen readers as an alert. A success is not shown here: a pop-up closes and the app toasts it
 * (see each form's onSaved). Field errors are shown beside their fields by each form.
 */
export function ActionMessage({ state }: { state: ActionState }) {
  if (state.status === 'error' && !state.fieldErrors) {
    return (
      <p role="alert" className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]">
        {state.message}
      </p>
    );
  }

  return null;
}
