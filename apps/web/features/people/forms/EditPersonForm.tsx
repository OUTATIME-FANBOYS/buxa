'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef } from 'react';
import type { Person } from '@buxa/contracts';
import { CAMP_ROLES, CAMP_ROLE_LABELS } from '@buxa/domain';
import { personPath } from '@/config/routes';
import { Field } from '@/components/ui';
import { fieldError, idle } from '@/lib/actions/state';
import { updatePersonAction } from '../actions';
import { FormMessage } from './FormMessage';

/** The fields a person's details can change, as the form posts them. Contact fields and date of birth are only given to staff. */
export type EditablePerson = Pick<Person, 'id' | 'givenName' | 'familyName' | 'preferredName' | 'roles' | 'dateOfBirth' | 'email' | 'phone'>;

/**
 * Change a person's details. Pre-filled from the person; the server validates and refuses what the role may not do. Works without
 * JavaScript as a plain POST.
 */
export function EditPersonForm({ person }: { person: EditablePerson }) {
  const [state, formAction, pending] = useActionState(updatePersonAction, idle);
  const formRef = useRef<HTMLFormElement>(null);

  // A field error moves focus to the first invalid field, so the person can correct it without searching the page.
  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  const err = (name: string) => fieldError(state, name);
  const invalid = (name: string) => (err(name) ? true : undefined);

  return (
    <form ref={formRef} action={formAction} className="panel stack people-form" aria-describedby="people-form-help">
      <input type="hidden" name="id" value={person.id} />
      <p id="people-form-help" className="muted">Fields marked with an asterisk are required.</p>

      <fieldset className="plain">
        <legend className="field-label">Name</legend>
        <div className="people-form-grid">
          <Field label="First name *" error={err('givenName')}>
            <input name="givenName" defaultValue={person.givenName} autoComplete="off" maxLength={80} aria-invalid={invalid('givenName')} autoFocus />
          </Field>
          <Field label="Family name *" error={err('familyName')}>
            <input name="familyName" defaultValue={person.familyName} autoComplete="off" maxLength={80} aria-invalid={invalid('familyName')} />
          </Field>
          <Field label="Preferred name" error={err('preferredName')} hint="The name people use, if it is not the first name.">
            <input name="preferredName" defaultValue={person.preferredName ?? ''} autoComplete="off" maxLength={80} aria-invalid={invalid('preferredName')} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="plain">
        <legend className="field-label">Roles *</legend>
        <p className="field-hint">Choose everything that applies. A camper must stay in a household that has a parent or guardian.</p>
        <div className="people-checks">
          {CAMP_ROLES.map(role => (
            <label key={role} className="people-check">
              <input type="checkbox" name="roles" value={role} defaultChecked={person.roles.includes(role)} /> {CAMP_ROLE_LABELS[role]}
            </label>
          ))}
        </div>
        {err('roles') && <p className="field-error" role="alert">{err('roles')}</p>}
      </fieldset>

      <fieldset className="plain">
        <legend className="field-label">Contact and age</legend>
        <div className="people-form-grid">
          <Field label="Date of birth" error={err('dateOfBirth')} hint="Only used to tell whether someone is under 18. Leave blank to clear it.">
            <input type="date" name="dateOfBirth" defaultValue={person.dateOfBirth ?? ''} aria-invalid={invalid('dateOfBirth')} />
          </Field>
          <Field label="Email" error={err('email')}>
            <input type="email" name="email" defaultValue={person.email ?? ''} autoComplete="off" maxLength={254} aria-invalid={invalid('email')} />
          </Field>
          <Field label="Phone" error={err('phone')}>
            <input type="tel" name="phone" defaultValue={person.phone ?? ''} autoComplete="off" maxLength={32} aria-invalid={invalid('phone')} />
          </Field>
        </div>
      </fieldset>

      <FormMessage state={state} />
      <div className="row">
        <button className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</button>
        <Link className="btn" href={personPath(person.id)}>Cancel</Link>
      </div>
    </form>
  );
}
