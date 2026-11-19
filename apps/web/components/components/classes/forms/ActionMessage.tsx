import type { ActionState } from '@buxa/shared';

/**
 * A form-level result, announced to screen readers. Errors are assertive so they are not missed; a success is polite.
 * Field errors are shown beside their fields by each form.
 */
export function ActionMessage({ state }: { state: ActionState }) {
  if (state.status === 'success') {
    return state.message ? (
      <p role="status" className="people-message people-message-ok">
        {state.message}
      </p>
    ) : null;
  }
  if (state.status === 'error' && !state.fieldErrors) {
    return (
      <p role="alert" className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]">
        {state.message}
      </p>
    );
  }

  return null;
}
