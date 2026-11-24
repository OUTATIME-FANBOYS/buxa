'use client';

import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Field } from '@/components/elements';
import { Checkbox, DatePicker, TextField } from '@/components/atoms';
import { fieldError, flaggedClassesSummary, idle } from '@buxa/shared';
import type { Session } from '@buxa/contracts';
import { previewSessionDatesAction, updateSessionAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';

/**
 * The fields of the Edit session dialog: name, description, first and last day, and the public flag. The Save and Cancel buttons belong to the dialog's pinned footer, so the form is tied to them by
 * `formId` and reports `pending` through `onPendingChange`. The dialog closes, and toasts the message, through `onSaved`.
 *
 * When the dates change, the form first asks the server which classes would fall outside them. If any would, a confirmation lists them
 * (Confirm or Cancel) before the save. A change that the server would refuse saves at once, so its reason shows as usual.
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
  /** `flaggedCount` is the number of classes the save flagged (0 when none), so the dialog can offer to fix them. */
  onSaved: (message: string, flaggedCount: number) => void;
}) {
  const [state, formAction, pending] = useActionState(updateSessionAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  /** Set just before the form is submitted again after the person confirmed (or nothing needed confirming), so the check runs once. */
  const skipCheck = useRef(false);
  const flaggedCount = useRef(0);
  const [confirmNames, setConfirmNames] = useState<string[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
    if (state.status === 'success') {
      onSaved(state.message ?? 'Saved.', flaggedCount.current);
    }
  }, [state, onSaved]);

  useEffect(() => {
    onPendingChange(pending || checking);
  }, [pending, checking, onPendingChange]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (skipCheck.current) {
      skipCheck.current = false;

      return;
    }
    const data = new FormData(event.currentTarget);
    if (data.get('startsOn') === session.startsOn && data.get('endsOn') === session.endsOn) {
      return;
    }
    event.preventDefault();
    setCheckError(null);
    setChecking(true);
    void previewSessionDatesAction(data).then(result => {
      setChecking(false);
      if (!result.ok) {
        setCheckError(result.message);

        return;
      }
      if (result.outside.length > 0 && result.blocked.length === 0) {
        flaggedCount.current = result.outside.length;
        setConfirmNames(result.outside);

        return;
      }
      flaggedCount.current = 0;
      skipCheck.current = true;
      formRef.current?.requestSubmit();
    });
  };

  const confirmSave = () => {
    setConfirmNames(null);
    skipCheck.current = true;
    formRef.current?.requestSubmit();
  };

  const err = (name: string) => fieldError(state, name);

  return (
    <form
      id={formId}
      ref={formRef}
      action={formAction}
      onSubmit={submit}
      noValidate
      className="class-form session-form"
    >
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
      {confirmNames && (
        <div className="session-dates-confirm" role="group" aria-label="Classes outside the new dates">
          <p>{flaggedClassesSummary(confirmNames)}</p>
          <p className="class-helper">
            Their times are kept. Each one is marked &ldquo;Dates outside session&rdquo; until you fix its dates, and it
            takes no places until then.
          </p>
          <div className="session-dates-confirm__actions">
            <Button type="button" variant="glass" onClick={() => setConfirmNames(null)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={confirmSave}>
              Confirm
            </Button>
          </div>
        </div>
      )}
      {checkError && (
        <p className="class-helper" role="status">
          {checkError}
        </p>
      )}
      <ActionMessage state={state} />
    </form>
  );
}
