'use client';

import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import { Field, Button } from '@/components/elements';
import { Checkbox, DatePicker, TextField } from '@/components/atoms';
import { ROUTES } from '@/config/routes';
import { fieldError, idle } from '@buxa/shared';
import { createSessionAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';
import { PriceFields } from './PriceFields';

/**
 * A new session: its name, description, first and last day (calendar dates; the session holds the classes that run in it) and its
 * price. `variant` says where it renders: on its own page (a panel, with its own Cancel link and Create button) or in the Sessions
 * page's dialog. In the dialog the Cancel and Create buttons belong to the dialog's pinned footer, so the form is tied to them by
 * `formId` and reports `pending` through `onPendingChange`. The fields, validation and action are the same.
 */
export function NewSessionForm({
  variant = 'page',
  formId,
  onPendingChange,
  onSaved,
}: {
  variant?: 'page' | 'dialog';
  formId?: string;
  onPendingChange?: (pending: boolean) => void;
  /** Runs with the server's message when the session is created (the pop-up closes and toasts it). */
  onSaved?: (message: string) => void;
} = {}) {
  const [state, formAction, pending] = useActionState(createSessionAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const [discountProblem, setDiscountProblem] = useState(false);
  const inDialog = variant === 'dialog';

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  useEffect(() => {
    if (state.status === 'success') {
      onSaved?.(state.message ?? 'Session added.');
    }
  }, [state, onSaved]);

  // A discount that leaves no price is refused here, with its message on the field, before anything is sent.
  const refuseIfDiscountInvalid = (event: FormEvent<HTMLFormElement>) => {
    if (discountProblem) {
      event.preventDefault();
    }
  };

  const err = (name: string) => fieldError(state, name);

  return (
    <form
      id={formId}
      ref={formRef}
      action={formAction}
      noValidate
      onSubmit={refuseIfDiscountInvalid}
      className={`${inDialog ? '' : 'panel '}class-form session-form`}
      aria-describedby="session-form-help"
    >
      <p id="session-form-help" className="class-helper">
        Fields marked * are required. Add its classes after you save.
      </p>
      <TextField
        label="Session name"
        isRequired
        name="name"
        error={err('name')}
        maxLength={120}
        autoComplete="off"
        autoFocus={!inDialog}
      />
      <Field label="Description" error={err('description')} hint="What the session is. Shown to staff.">
        <textarea name="description" rows={3} maxLength={2000} aria-invalid={err('description') ? true : undefined} />
      </Field>
      {/* Start and End: two equal columns (50%), side by side. */}
      <div className="buxa:grid buxa:grid-cols-2 buxa:gap-[var(--s3)] buxa:items-end">
        <DatePicker label="Start" name="startsOn" error={err('startsOn')} isRequired />
        <DatePicker label="End" name="endsOn" error={err('endsOn')} isRequired />
      </div>
      <Checkbox name="isPublic" value="on">
        Show this session on the public pages
      </Checkbox>
      <PriceFields error={err} onDiscountProblem={setDiscountProblem} />
      {/* A pop-up's create posts dialog=1, so the action returns a success instead of redirecting to the new session. */}
      {inDialog && <input type="hidden" name="dialog" value="1" />}
      <ActionMessage state={state} />
      {!inDialog && (
        <div className="classes-actions">
          <Button variant="glass" className="classes-target" href={ROUTES.sessions}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon="plus"
            className="classes-target"
            disabled={pending || discountProblem}
          >
            {pending ? 'Saving...' : 'Create session'}
          </Button>
        </div>
      )}
    </form>
  );
}
