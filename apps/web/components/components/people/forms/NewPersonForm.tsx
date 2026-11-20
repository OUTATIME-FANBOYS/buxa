'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { CAMP_ROLES, CAMP_ROLE_LABELS, type CampRole } from '@buxa/domain';
import { Button } from '@/components/elements';
import { DatePicker, HiddenField, Select, TextField } from '@/components/atoms';
import { ROUTES } from '@/config/routes';
import { fieldError, idle } from '@buxa/shared';
import { createPersonAction } from '@/actions/people';
import { ADD_PERSON_INTRO } from '@buxa/shared';
import { householdChoiceLabel, type HouseholdChoice } from '@buxa/shared';
import { FormMessage } from './FormMessage';

interface HouseholdTarget {
  id: string;
  name: string;
}

/** A family role (a camper, a parent or guardian) is recorded with a household. Only membership of this set is decided here. */
const FAMILY_ROLES: ReadonlySet<CampRole> = new Set<CampRole>(['camper', 'guardian']);
/** The roles come from CAMP_ROLES (the domain's list, so the form and the domain cannot drift), in two headed groups. */
const ROLE_GROUPS: readonly { heading: string; roles: readonly CampRole[] }[] = [
  { heading: 'Family', roles: CAMP_ROLES.filter(role => FAMILY_ROLES.has(role)) },
  { heading: 'Staff and participants', roles: CAMP_ROLES.filter(role => !FAMILY_ROLES.has(role)) },
];

/**
 * Add a person. With `household` (from the guardian's page) the person joins that household. Otherwise the form offers the camp's
 * existing households, or a new one. The Household section appears only for a camper or a parent or guardian. Their email is
 * recorded with the household; any other role's email is the person's own, and shows once a role is chosen.
 * `variant` says where it renders: on its own page (a panel with its own footer, Cancel back to People and Add person) or in the
 * People page's dialog, where the shared form pop-up's footer submits the form by `formId` and this component has no footer.
 */
export function NewPersonForm({
  household,
  households,
  variant = 'page',
  formId = 'new-person-form',
  onPendingChange,
  onSaved,
}: {
  household: HouseholdTarget | null;
  households: readonly HouseholdChoice[];
  variant?: 'page' | 'dialog';
  formId?: string;
  onPendingChange?: (pending: boolean) => void;
  /** Runs with the server's message when the person is added (the pop-up closes and toasts it). */
  onSaved?: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(createPersonAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const inDialog = variant === 'dialog';
  // One role at a time. Selecting a role selects it; selecting it again clears it, so the role is required again.
  const [role, setRole] = useState<CampRole | null>(null);

  // A field error moves focus to the first invalid field, so the person can correct it without searching the page.
  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);
  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);
  useEffect(() => {
    if (state.status === 'success') {
      onSaved?.(state.message ?? 'Person added.');
    }
  }, [state, onSaved]);

  const err = (name: string) => fieldError(state, name);
  const showHousehold = role === 'camper' || role === 'guardian';
  const showRelationship = role === 'camper';
  // A person's own email shows once a role is chosen, unless that role is a family role (then the email goes under Household).
  const showOwnEmail = role !== null && !FAMILY_ROLES.has(role);
  const showHouseholdEmail = showHousehold;

  return (
    <form
      ref={formRef}
      id={formId}
      action={formAction}
      className={`${inDialog ? '' : 'panel '}people-form person-form`}
    >
      <div className="people-form-grid">
        <TextField
          label="First name"
          isRequired
          name="givenName"
          error={err('givenName')}
          autoComplete="off"
          maxLength={80}
          autoFocus={!inDialog}
        />
        <TextField label="Last name" name="familyName" error={err('familyName')} autoComplete="off" maxLength={80} />
      </div>

      <div className="people-form-half">
        <DatePicker
          label="Date of birth"
          name="dateOfBirth"
          error={err('dateOfBirth')}
          hint="Only used to tell whether someone is under 18."
        />
        <TextField label="Phone" type="tel" name="phone" error={err('phone')} autoComplete="off" maxLength={32} />
      </div>

      <fieldset className="plain person-section buxa:border-0 buxa:p-0 buxa:m-0 buxa:min-w-0 buxa:grid buxa:gap-[var(--s4)]">
        <legend className="person-legend">
          Roles
          <span className="field-required" aria-hidden="true">
            {' *'}
          </span>
        </legend>
        <p className="person-helper">Choose one. Select it again to clear it.</p>
        {ROLE_GROUPS.map(group => (
          <div key={group.heading} className="person-role-group">
            <h3 className="person-role-heading">{group.heading}</h3>
            <div className="people-checks">
              {group.roles.map(option => (
                <label key={option} className="people-check">
                  <input
                    type="radio"
                    name="roles"
                    value={option}
                    checked={role === option}
                    onChange={() => undefined}
                    onClick={() => setRole(current => (current === option ? null : option))}
                  />
                  <span>{CAMP_ROLE_LABELS[option]}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        {err('roles') && (
          <p className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
            {err('roles')}
          </p>
        )}
      </fieldset>

      {showOwnEmail && (
        <TextField label="Email" type="email" name="email" error={err('email')} autoComplete="off" maxLength={254} />
      )}

      {showHousehold && (
        <fieldset className="plain person-section buxa:border-0 buxa:p-0 buxa:m-0 buxa:min-w-0 buxa:grid buxa:gap-[var(--s4)]">
          <legend className="person-legend">Household</legend>
          <p className="person-helper">{ADD_PERSON_INTRO}</p>
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
                autoComplete="off"
                maxLength={120}
              />
            </>
          )}
          {showRelationship && (
            <TextField
              label="How they are related"
              name="relationship"
              error={err('relationship')}
              hint="For example: son, daughter, mother, father. Needed when they join a household."
              autoComplete="off"
              maxLength={40}
            />
          )}
          {showHouseholdEmail && (
            <TextField
              label="Email"
              type="email"
              name="householdEmail"
              error={err('householdEmail')}
              hint="Kept with the household."
              autoComplete="off"
              maxLength={254}
            />
          )}
          {household && err('householdId') && (
            <p className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
              {err('householdId')}
            </p>
          )}
        </fieldset>
      )}

      {/* A pop-up's add posts dialog=1, so the action returns a success instead of redirecting to the new person. */}
      {inDialog && <input type="hidden" name="dialog" value="1" />}
      <FormMessage state={state} />
      {!inDialog && (
        <div className="person-actions">
          <Button href={ROUTES.people}>Cancel</Button>
          <Button variant="primary" icon="plus" disabled={pending}>
            {pending ? 'Adding…' : 'Add person'}
          </Button>
        </div>
      )}
    </form>
  );
}
