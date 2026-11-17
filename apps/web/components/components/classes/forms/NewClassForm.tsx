'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef } from 'react';
import { Field } from '@/components/elements/export';
import { ROUTES } from '@/config/routes';
import { fieldError, idle } from '@buxa/shared';
import { createClassAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';

/**
 * A new class: name, description, ages, default places, and an optional instructor ratio (stored, not enforced yet).
 * `variant` says where it renders: on its own page (a panel, with a Cancel link back to the list) or in the Classes page's dialog
 * (no panel, with a Cancel button that closes the dialog through `onCancel`). The fields, validation and action are the same.
 */
export function NewClassForm({ variant = 'page', onCancel }: { variant?: 'page' | 'dialog'; onCancel?: () => void } = {}) {
  const [state, formAction, pending] = useActionState(createClassAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const inDialog = variant === 'dialog';

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  const err = (name: string) => fieldError(state, name);
  const invalid = (name: string) => (err(name) ? true : undefined);

  return (
    <form ref={formRef} action={formAction} className={`${inDialog ? '' : 'panel '}class-form classes-form`} aria-describedby="class-form-help">
      <p id="class-form-help" className="class-helper">Fields marked with an asterisk are required.</p>
      <Field label="Class name *" error={err('name')}>
        <input name="name" maxLength={120} autoComplete="off" aria-invalid={invalid('name')} data-autofocus autoFocus={!inDialog} />
      </Field>
      <Field label="Description" error={err('description')} hint="What campers do in this class. Shown to staff.">
        <textarea name="description" rows={3} maxLength={2000} aria-invalid={invalid('description')} />
      </Field>
      <div className="form-row">
        <Field label="Youngest age *" error={err('minAge')}>
          <input name="minAge" inputMode="numeric" autoComplete="off" aria-invalid={invalid('minAge')} />
        </Field>
        <Field label="Oldest age *" error={err('maxAge')}>
          <input name="maxAge" inputMode="numeric" autoComplete="off" aria-invalid={invalid('maxAge')} />
        </Field>
      </div>
      <Field label="Default places *" error={err('capacity')} hint="Each new session starts with this many places. A session can change its own.">
        <input name="capacity" inputMode="numeric" autoComplete="off" aria-invalid={invalid('capacity')} />
      </Field>
      <fieldset className="plain class-section">
        <legend className="class-legend">Instructor ratio (optional)</legend>
        <p className="field-hint">For example 1 instructor for 8 campers. Saved with the class. Not enforced yet.</p>
        <div className="form-row">
          <Field label="Instructors" error={err('ratioInstructors')}>
            <input name="ratioInstructors" inputMode="numeric" autoComplete="off" aria-invalid={invalid('ratioInstructors')} />
          </Field>
          <Field label="Campers" error={err('ratioCampers')}>
            <input name="ratioCampers" inputMode="numeric" autoComplete="off" aria-invalid={invalid('ratioCampers')} />
          </Field>
        </div>
      </fieldset>
      <ActionMessage state={state} />
      <div className="classes-actions">
        {inDialog
          ? <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          : <Link className="btn btn-ghost classes-target" href={ROUTES.classes}>Cancel</Link>}
        <button type="submit" className={inDialog ? 'btn btn-primary' : 'btn btn-primary classes-target'} disabled={pending}>
          {pending ? 'Saving...' : 'Create class'}
        </button>
      </div>
    </form>
  );
}
