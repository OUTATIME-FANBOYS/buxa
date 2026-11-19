'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Field, Button } from '@/components/elements';
import { TextField } from '@/components/atoms';
import { ROUTES } from '@/config/routes';
import { fieldError, idle } from '@buxa/shared';
import { createClassAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';

/**
 * A new class: name, description, ages, default places, and an optional instructor ratio (stored, not enforced yet).
 * `variant` says where it renders: on its own page (a panel, with a Cancel link back to the list) or in the Classes page's dialog
 * (no panel, with a Cancel button that closes the dialog through `onCancel`). The fields, validation and action are the same.
 */
export function NewClassForm({
  variant = 'page',
  onCancel,
}: { variant?: 'page' | 'dialog'; onCancel?: () => void } = {}) {
  const [state, formAction, pending] = useActionState(createClassAction, idle);
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
      className={`${inDialog ? '' : 'panel '}class-form classes-form`}
      aria-describedby="class-form-help"
    >
      <p id="class-form-help" className="class-helper">
        Fields marked with an asterisk are required.
      </p>
      <TextField
        label="Class name *"
        name="name"
        error={err('name')}
        maxLength={120}
        autoComplete="off"
        autoFocus={!inDialog}
      />
      <Field label="Description" error={err('description')} hint="What campers do in this class. Shown to staff.">
        <textarea name="description" rows={3} maxLength={2000} aria-invalid={err('description') ? true : undefined} />
      </Field>
      <div className="form-row buxa:flex buxa:flex-wrap buxa:gap-[var(--s3)] buxa:items-end buxa:[&>.field]:flex-[1_1_180px] buxa:[&>.field]:min-w-0 buxa:[&>.button]:flex-none buxa:[&>a.button]:flex-none">
        <TextField label="Youngest age *" name="minAge" inputMode="numeric" error={err('minAge')} autoComplete="off" />
        <TextField label="Oldest age *" name="maxAge" inputMode="numeric" error={err('maxAge')} autoComplete="off" />
      </div>
      <TextField
        label="Default places *"
        name="capacity"
        inputMode="numeric"
        error={err('capacity')}
        hint="Each new session starts with this many places. A session can change its own."
        autoComplete="off"
      />
      <fieldset className="plain class-section">
        <legend className="class-legend">Instructor ratio (optional)</legend>
        <p className="field-hint buxa:text-[length:var(--fs-s)] buxa:text-[var(--text-3)]">
          For example 1 instructor for 8 campers. Saved with the class. Not enforced yet.
        </p>
        <div className="form-row buxa:flex buxa:flex-wrap buxa:gap-[var(--s3)] buxa:items-end buxa:[&>.field]:flex-[1_1_180px] buxa:[&>.field]:min-w-0 buxa:[&>.button]:flex-none buxa:[&>a.button]:flex-none">
          <TextField
            label="Instructors"
            name="ratioInstructors"
            inputMode="numeric"
            error={err('ratioInstructors')}
            autoComplete="off"
          />
          <TextField
            label="Campers"
            name="ratioCampers"
            inputMode="numeric"
            error={err('ratioCampers')}
            autoComplete="off"
          />
        </div>
      </fieldset>
      <ActionMessage state={state} />
      <div className="classes-actions">
        {inDialog ? (
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <Button variant="ghost" className="classes-target" href={ROUTES.classes}>
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
          {pending ? 'Saving...' : 'Create class'}
        </Button>
      </div>
    </form>
  );
}
