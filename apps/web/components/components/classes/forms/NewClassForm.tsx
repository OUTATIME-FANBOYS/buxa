'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef } from 'react';
import { Field } from '@/components/elements/export';
import { ROUTES } from '@/config/routes';
import { fieldError, idle } from '@buxa/shared';
import { createClassAction } from '@buxa/server/composers/index';
import { ActionMessage } from './ActionMessage';

/** A new class: name, description, ages, default places, and an optional instructor ratio (stored, not enforced yet). */
export function NewClassForm() {
  const [state, formAction, pending] = useActionState(createClassAction, idle);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  const err = (name: string) => fieldError(state, name);
  const invalid = (name: string) => (err(name) ? true : undefined);

  return (
    <form ref={formRef} action={formAction} className="panel stack classes-form" aria-describedby="class-form-help">
      <p id="class-form-help" className="muted">Fields marked with an asterisk are required.</p>
      <Field label="Class name *" error={err('name')}>
        <input name="name" maxLength={120} autoComplete="off" aria-invalid={invalid('name')} autoFocus />
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
      <fieldset className="plain">
        <legend className="field-label">Instructor ratio (optional)</legend>
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
        <button type="submit" className="btn btn-primary classes-target" disabled={pending}>{pending ? 'Saving...' : 'Create class'}</button>
        <Link className="btn btn-ghost classes-target" href={ROUTES.classes}>Cancel</Link>
      </div>
    </form>
  );
}
