'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef } from 'react';
import { CAMP_ROLES, CAMP_ROLE_LABELS } from '@buxa/domain';
import { Field } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { fieldError, idle } from '@/lib/actions/state';
import { createPersonAction } from '../actions';
import { CAMPER_NEEDS_HOUSEHOLD } from '../lib/copy';
import { FormMessage } from './FormMessage';

export interface HouseholdTarget { id: string; name: string }

/**
 * Add a person. With `household` (from the guardian's page) the person joins that household; otherwise the form can start a new
 * household, for a parent or guardian. Works without JavaScript as a plain POST.
 */
export function NewPersonForm({ household }: { household: HouseholdTarget | null }) {
  const [state, formAction, pending] = useActionState(createPersonAction, idle);
  const formRef = useRef<HTMLFormElement>(null);

  // A field error moves focus to the first invalid field, so the person can correct it without searching the page.
  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  const err = (name: string) => fieldError(state, name);
  const invalid = (name: string) => (err(name) ? true : undefined);

  return (
    <form ref={formRef} action={formAction} className="panel stack people-form" aria-describedby="people-form-help">
      <p id="people-form-help" className="muted">Fields marked with an asterisk are required.</p>

      <fieldset className="plain">
        <legend className="field-label">Name</legend>
        <div className="people-form-grid">
          <Field label="First name *" error={err('givenName')}>
            <input name="givenName" autoComplete="off" maxLength={80} aria-invalid={invalid('givenName')} autoFocus />
          </Field>
          <Field label="Family name *" error={err('familyName')}>
            <input name="familyName" autoComplete="off" maxLength={80} aria-invalid={invalid('familyName')} />
          </Field>
          <Field label="Preferred name" error={err('preferredName')} hint="The name people use, if it is not the first name.">
            <input name="preferredName" autoComplete="off" maxLength={80} aria-invalid={invalid('preferredName')} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="plain">
        <legend className="field-label">Roles *</legend>
        <p className="field-hint">Choose everything that applies. Someone can be a parent and an instructor.</p>
        <div className="people-checks">
          {CAMP_ROLES.map(role => (
            <label key={role} className="people-check">
              <input type="checkbox" name="roles" value={role} /> {CAMP_ROLE_LABELS[role]}
            </label>
          ))}
        </div>
        {err('roles') && <p className="field-error" role="alert">{err('roles')}</p>}
      </fieldset>

      <fieldset className="plain">
        <legend className="field-label">Household</legend>
        {household ? (
          <>
            <input type="hidden" name="householdId" value={household.id} />
            <p>This person joins the <strong>{household.name}</strong> household.</p>
            <Field label="How they are related" error={err('relationship')} hint="For example: son, daughter, mother, father.">
              <input name="relationship" autoComplete="off" maxLength={40} aria-invalid={invalid('relationship')} />
            </Field>
            {err('householdId') && <p className="field-error" role="alert">{err('householdId')}</p>}
          </>
        ) : (
          <>
            <Field label="New household name" error={err('newHouseholdName') ?? err('householdId')} hint={CAMPER_NEEDS_HOUSEHOLD}>
              <input name="newHouseholdName" autoComplete="off" maxLength={120} aria-invalid={invalid('newHouseholdName') ?? invalid('householdId')} />
            </Field>
          </>
        )}
      </fieldset>

      <fieldset className="plain">
        <legend className="field-label">Contact and age</legend>
        <div className="people-form-grid">
          <Field label="Date of birth" error={err('dateOfBirth')} hint="Only used to tell whether someone is under 18.">
            <input type="date" name="dateOfBirth" aria-invalid={invalid('dateOfBirth')} />
          </Field>
          <Field label="Email" error={err('email')}>
            <input type="email" name="email" autoComplete="off" maxLength={254} aria-invalid={invalid('email')} />
          </Field>
          <Field label="Phone" error={err('phone')}>
            <input type="tel" name="phone" autoComplete="off" maxLength={32} aria-invalid={invalid('phone')} />
          </Field>
        </div>
      </fieldset>

      <FormMessage state={state} />
      <div className="row">
        <button className="btn btn-primary" disabled={pending}>{pending ? 'Adding…' : 'Add person'}</button>
        <Link className="btn" href={ROUTES.people}>Cancel</Link>
      </div>
    </form>
  );
}
