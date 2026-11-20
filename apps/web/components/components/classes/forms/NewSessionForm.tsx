'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Field, Button } from '@/components/elements';
import { DatePicker, TextField } from '@/components/atoms';
import { ROUTES } from '@/config/routes';
import { fieldError, idle } from '@buxa/shared';
import { createSessionAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';
import { PriceFields } from './PriceFields';

/**
 * A new session: its name, description and first and last day (calendar dates; the session holds the classes that run in it).
 * `variant` says where it renders: on its own page (a panel, with a Cancel link back to the list) or in the Sessions page's dialog
 * (no panel, with a Cancel button that closes the dialog through `onCancel`). The fields, validation and action are the same.
 */
export function NewSessionForm({
  variant = 'page',
  onCancel,
}: { variant?: 'page' | 'dialog'; onCancel?: () => void } = {}) {
  const [state, formAction, pending] = useActionState(createSessionAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const inDialog = variant === 'dialog';

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  const err = (name: string) => fieldError(state, name);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={`${inDialog ? '' : 'panel '}class-form session-form`}
      aria-describedby="session-form-help"
    >
      <p id="session-form-help" className="class-helper">
        Fields marked with an asterisk are required. A session is a date range; its classes are added after it is saved.
      </p>
      <TextField
        label="Session name *"
        name="name"
        error={err('name')}
        maxLength={120}
        autoComplete="off"
        autoFocus={!inDialog}
      />
      <Field label="Description" error={err('description')} hint="What the session is. Shown to staff.">
        <textarea name="description" rows={3} maxLength={2000} aria-invalid={err('description') ? true : undefined} />
      </Field>
      <div className="form-row buxa:flex buxa:flex-wrap buxa:gap-[var(--s3)] buxa:items-end buxa:[&>.field]:flex-[1_1_180px] buxa:[&>.field]:min-w-0">
        <DatePicker label="First day" name="startsOn" error={err('startsOn')} isRequired />
        <DatePicker label="Last day" name="endsOn" error={err('endsOn')} isRequired />
      </div>
      <PriceFields error={err} />
      <ActionMessage state={state} />
      <div className="classes-actions">
        {inDialog ? (
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <Button variant="ghost" className="classes-target" href={ROUTES.sessions}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          icon="plus"
          className={inDialog ? undefined : 'classes-target'}
          disabled={pending}
        >
          {pending ? 'Saving...' : 'Create session'}
        </Button>
      </div>
    </form>
  );
}
