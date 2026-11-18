'use client';

import { useActionState, useEffect, useRef } from 'react';
import { CAMP_ROLES, CAMP_ROLE_LABELS } from '@buxa/domain';
import { Button } from '@/components/elements';
import { Checkbox, DatePicker, HiddenField, Select, TextField } from '@/components/atoms';
import { ROUTES } from '@/config/routes';
import { fieldError, idle } from '@buxa/shared';
import { createPersonAction } from '@/actions/people';
import { CAMPER_NEEDS_HOUSEHOLD } from '@buxa/shared';
import { householdChoiceLabel, type HouseholdChoice } from '@buxa/shared';
import { FormMessage } from './FormMessage';

interface HouseholdTarget {
  id: string;
  name: string;
}

/**
 * Add a person. With `household` (from the guardian's page) the person joins that household. Otherwise the form offers the camp's
 * existing households, or a new one for a parent or guardian. Works without JavaScript as a plain POST.
 * `variant` says where it renders: on its own page (a panel, with a Cancel link back to People) or in the People page's dialog
 * (no panel, with a Cancel button that closes the dialog through `onCancel`). The fields, validation and action are the same.
 */
export function NewPersonForm({
  household,
  households,
  variant = 'page',
  onCancel,
}: {
  household: HouseholdTarget | null;
  households: readonly HouseholdChoice[];
  variant?: 'page' | 'dialog';
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState(createPersonAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const inDialog = variant === 'dialog';

  // A field error moves focus to the first invalid field, so the person can correct it without searching the page.
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
      className={`${inDialog ? '' : 'panel '}people-form person-form`}
      aria-describedby="people-form-help"
    >
      <p id="people-form-help" className="person-helper">
        Fields marked with an asterisk are required.
      </p>

      <fieldset className="plain person-section">
        <legend className="person-legend">Name</legend>
        <div className="people-form-grid">
          <TextField
            label="First name *"
            name="givenName"
            error={err('givenName')}
            autoComplete="off"
            maxLength={80}
            autoFocus={!inDialog}
          />
          <TextField
            label="Family name *"
            name="familyName"
            error={err('familyName')}
            autoComplete="off"
            maxLength={80}
          />
          <TextField
            label="Preferred name"
            name="preferredName"
            error={err('preferredName')}
            hint="The name people use, if it is not the first name."
            autoComplete="off"
            maxLength={80}
          />
        </div>
      </fieldset>

      <fieldset className="plain person-section">
        <legend className="person-legend">Roles *</legend>
        <p className="person-helper">Choose everything that applies. Someone can be a parent and an instructor.</p>
        <div className="people-checks">
          {CAMP_ROLES.map(role => (
            <Checkbox key={role} className="people-check" name="roles" value={role}>
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

      <fieldset className="plain person-section">
        <legend className="person-legend">Household</legend>
        {household ? (
          <>
            <HiddenField name="householdId" value={household.id} />
            <p>
              This person joins the <strong>{household.name}</strong> household.
            </p>
          </>
        ) : (
          <>
            {households.length > 0 && (
              <Select
                label="Existing household"
                name="householdId"
                defaultValue=""
                error={err('householdId')}
                hint="Join a household already in the camp. A child needs one with a parent or guardian in it."
                options={[
                  { value: '', label: 'Not an existing household' },
                  ...households.map(h => ({ value: h.id, label: householdChoiceLabel(h) })),
                ]}
              />
            )}
            <TextField
              label="New household name"
              name="newHouseholdName"
              error={err('newHouseholdName') ?? (households.length === 0 ? err('householdId') : undefined)}
              hint={CAMPER_NEEDS_HOUSEHOLD}
              autoComplete="off"
              maxLength={120}
            />
          </>
        )}
        <TextField
          label="How they are related"
          name="relationship"
          error={err('relationship')}
          hint="For example: son, daughter, mother, father. Needed when they join a household."
          autoComplete="off"
          maxLength={40}
        />
        {household && err('householdId') && (
          <p className="field-error" role="alert">
            {err('householdId')}
          </p>
        )}
      </fieldset>

      <fieldset className="plain person-section">
        <legend className="person-legend">Contact and age</legend>
        <div className="people-form-grid">
          <DatePicker
            label="Date of birth"
            name="dateOfBirth"
            error={err('dateOfBirth')}
            hint="Only used to tell whether someone is under 18."
          />
          <TextField label="Email" type="email" name="email" error={err('email')} autoComplete="off" maxLength={254} />
          <TextField label="Phone" type="tel" name="phone" error={err('phone')} autoComplete="off" maxLength={32} />
        </div>
      </fieldset>

      <FormMessage state={state} />
      <div className="person-actions">
        {inDialog ? (
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <Button href={ROUTES.people}>Cancel</Button>
        )}
        <Button variant="primary" icon="plus" disabled={pending}>
          {pending ? 'Adding…' : 'Add person'}
        </Button>
      </div>
    </form>
  );
}
