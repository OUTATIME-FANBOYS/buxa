'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Field } from '@/components/elements';
import { Checkbox, DatePicker, TextField } from '@/components/atoms';
import { fieldError, idle } from '@buxa/shared';
import type { Session } from '@buxa/contracts';
import { updateSessionAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';

/**
 * The fields of the Edit session dialog: name, description, first and last day, and the public flag. The Save and Cancel buttons belong to the dialog's pinned footer, so the form is tied to them by
 * `formId` and reports `pending` through `onPendingChange`. The dialog closes, and toasts the message, through `onSaved`.
 */
export function EditSessionForm({
  session,
  formId,
  onPendingChange,
  onSaved,
}: {
  session: Session;
  formId: string;
  onPendingChange: (pending: boolean) => void;
  onSaved: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(updateSessionAction, idle);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
    if (state.status === 'success') {
      onSaved(state.message ?? 'Saved.');
    }
  }, [state, onSaved]);

  useEffect(() => {
    onPendingChange(pending);
  }, [pending, onPendingChange]);

  const err = (name: string) => fieldError(state, name);

  return (
    <form id={formId} ref={formRef} action={formAction} noValidate className="class-form session-form">
      <input type="hidden" name="sessionId" value={session.id} />
      <p className="class-helper">Fields marked * are required.</p>
      <TextField
        label="Session name"
        isRequired
        name="name"
        defaultValue={session.name}
        error={err('name')}
        errorRole="status"
        maxLength={120}
        autoComplete="off"
        autoFocus
      />
      <Field label="Description" error={err('description')} hint="What the session is. Shown to staff.">
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={session.description}
          aria-invalid={err('description') ? true : undefined}
        />
      </Field>
      {/* Start and End: two equal columns, side by side, so the date fields are not full width. */}
      <div className="buxa:grid buxa:grid-cols-2 buxa:gap-[var(--s3)] buxa:items-end">
        <DatePicker label="Start" name="startsOn" defaultValue={session.startsOn} error={err('startsOn')} isRequired />
        <DatePicker label="End" name="endsOn" defaultValue={session.endsOn} error={err('endsOn')} isRequired />
      </div>
      <Checkbox name="isPublic" value="on" defaultSelected={session.isPublic}>
        Show this session on the public pages
      </Checkbox>
      <ActionMessage state={state} />
    </form>
  );
}
