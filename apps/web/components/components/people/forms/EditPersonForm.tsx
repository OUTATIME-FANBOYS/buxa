'use client';

import { useActionState, useEffect, useRef } from 'react';
import type { Person } from '@buxa/contracts';
import { CAMP_ROLES, CAMP_ROLE_LABELS } from '@buxa/domain';
import { personPath } from '@/config/routes';
import { Button } from '@/components/elements';
import { Checkbox, DatePicker, HiddenField, TextField } from '@/components/atoms';
import { fieldError, idle } from '@buxa/shared';
import { updatePersonAction } from '@/actions/people';
import { FormMessage } from './FormMessage';

/** The fields a person's details can change, as the form posts them. Contact fields and date of birth are only given to staff. */
export type EditablePerson = Pick<
  Person,
  'id' | 'givenName' | 'familyName' | 'preferredName' | 'roles' | 'dateOfBirth' | 'email' | 'phone'
>;

/**
 * Change a person's details. Pre-filled from the person; the server validates and refuses what the role may not do. Works without
 * JavaScript as a plain POST.
 */
export function EditPersonForm({ person }: { person: EditablePerson }) {
  const [state, formAction, pending] = useActionState(updatePersonAction, idle);
  const formRef = useRef<HTMLFormElement>(null);

  // A field error moves focus to the first invalid field, so the person can correct it without searching the page.
  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  const err = (name: string) => fieldError(state, name);

  return (
    <form ref={formRef} action={formAction} className="panel stack people-form" aria-describedby="people-form-help">
      <HiddenField name="id" value={person.id} />
      <p id="people-form-help" className="muted">
        Fields marked with an asterisk are required.
      </p>

      <fieldset className="plain">
        <legend className="field-label">Name</legend>
        <div className="people-form-grid">
          <TextField
            label="First name *"
            name="givenName"
            defaultValue={person.givenName}
            error={err('givenName')}
            autoComplete="off"
            maxLength={80}
            autoFocus
          />
          <TextField
            label="Family name *"
            name="familyName"
            defaultValue={person.familyName}
            error={err('familyName')}
            autoComplete="off"
            maxLength={80}
          />
          <TextField
            label="Preferred name"
            name="preferredName"
            defaultValue={person.preferredName ?? ''}
            error={err('preferredName')}
            hint="The name people use, if it is not the first name."
            autoComplete="off"
            maxLength={80}
          />
        </div>
      </fieldset>

      <fieldset className="plain">
        <legend className="field-label">Roles *</legend>
        <p className="field-hint">
          Choose everything that applies. A camper must stay in a household that has a parent or guardian.
        </p>
        <div className="people-checks">
          {CAMP_ROLES.map(role => (
            <Checkbox
              key={role}
              className="people-check"
              name="roles"
              value={role}
              defaultSelected={person.roles.includes(role)}
            >
              {CAMP_ROLE_LABELS[role]}
            </Checkbox>
          ))}
        </div>
        {err('roles') && (
          <p className="field-error" role="alert">
            {err('roles')}
          </p>
        )}
      </fieldset>

      <fieldset className="plain">
        <legend className="field-label">Contact and age</legend>
        <div className="people-form-grid">
          <DatePicker
            label="Date of birth"
            name="dateOfBirth"
            defaultValue={person.dateOfBirth ?? null}
            error={err('dateOfBirth')}
            hint="Only used to tell whether someone is under 18. Leave blank to clear it."
          />
          <TextField
            label="Email"
            type="email"
            name="email"
            defaultValue={person.email ?? ''}
            error={err('email')}
            autoComplete="off"
            maxLength={254}
          />
          <TextField
            label="Phone"
            type="tel"
            name="phone"
            defaultValue={person.phone ?? ''}
            error={err('phone')}
            autoComplete="off"
            maxLength={32}
          />
        </div>
      </fieldset>

      <FormMessage state={state} />
      <div className="row">
        <Button variant="primary" icon="save" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
        <Button href={personPath(person.id)}>Cancel</Button>
      </div>
    </form>
  );
}
