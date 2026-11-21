'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import type { Person } from '@buxa/contracts';
import { CAMP_ROLES, CAMP_ROLE_LABELS, type CampRole } from '@buxa/domain';
import { Button } from '@/components/elements';
import { DatePicker, HiddenField, Select, TextField } from '@/components/atoms';
import { ROUTES, personPath } from '@/config/routes';
import { fieldError, idle } from '@buxa/shared';
import { createPersonAction, updatePersonAction } from '@/actions/people';
import { ADD_PERSON_INTRO } from '@buxa/shared';
import { householdChoiceLabel, type HouseholdChoice } from '@buxa/shared';
import { FormMessage } from './FormMessage';
import { ComingSoonInvite, PersonInvite, personInviteDetails } from './PersonInvite';

/**
 * An instructor is a teacher at the camp, and the only role an invite can grant (the invite is for the teacher role). The invite
 * button and the sign-in hand-off are offered for this role only.
 */
const INVITE_ROLE: CampRole = 'instructor';

/** The fields a person's details can change, as the form posts them. Contact fields and date of birth are only given to staff. */
export type EditablePerson = Pick<
  Person,
  'id' | 'givenName' | 'familyName' | 'preferredName' | 'roles' | 'dateOfBirth' | 'email' | 'phone'
>;

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

interface PersonFormCommon {
  /** Where the form renders: on its own page (a panel with its own footer) or in a pop-up, whose footer submits it by `formId`. */
  variant?: 'page' | 'dialog';
  formId?: string;
  onPendingChange?: (pending: boolean) => void;
  /**
   * Runs with the server's message when a dialog save succeeds. `stay` is true for a new instructor: the pop-up stays open and shows
   * the teacher invite link. Otherwise the pop-up closes and toasts the message.
   */
  onSaved?: (message: string, stay: boolean) => void;
}

/**
 * The one person form, in two modes. `create` adds a person: with `household` (from the guardian's page) the person joins that
 * household, otherwise the form offers the camp's households or a new one. `edit` changes a person's details, pre-filled from
 * `person`; it has no household section, since the update does not move anyone between households.
 * A role is one choice when adding (a radio) and any number when editing (checkboxes), so an existing person keeps all their roles.
 */
export type PersonFormProps = PersonFormCommon &
  (
    | { mode: 'create'; household: HouseholdTarget | null; households: readonly HouseholdChoice[] }
    | { mode: 'edit'; person: EditablePerson }
  );

export function PersonForm(props: PersonFormProps) {
  const { variant = 'page', formId = 'person-form', onPendingChange, onSaved } = props;
  const isEdit = props.mode === 'edit';
  const person = props.mode === 'edit' ? props.person : null;
  const household = props.mode === 'create' ? props.household : null;
  const households = props.mode === 'create' ? props.households : [];

  const [state, formAction, pending] = useActionState(isEdit ? updatePersonAction : createPersonAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const inDialog = variant === 'dialog';
  // Adding: one role at a time. Selecting a role selects it; selecting it again clears it, so the role is required again.
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
  // Saved as an instructor (a teacher): the pop-up stays open and sends the teacher invite, so its link is shown once.
  const [savedTeacher, setSavedTeacher] = useState(false);
  useEffect(() => {
    if (state.status === 'success') {
      const teacher = !isEdit && role === INVITE_ROLE;
      setSavedTeacher(teacher);
      onSaved?.(state.message ?? (isEdit ? 'Changes saved.' : 'Person added.'), teacher);
    }
    // Only a new success matters; the role is read at the moment it is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, onSaved]);

  const err = (name: string) => fieldError(state, name);
  // Editing shows the person's own email always; adding shows it once a role that is not a family role is chosen.
  const showOwnEmail = isEdit || (role !== null && !FAMILY_ROLES.has(role));
  const showHousehold = !isEdit && (role === 'camper' || role === 'guardian');
  const showRelationship = role === 'camper';
  const showHouseholdEmail = showHousehold;
  // Only an instructor gets the invite. Editing asks about the person's saved roles; adding asks about the role just chosen.
  const inviteAvailable = isEdit ? (person?.roles.includes(INVITE_ROLE) ?? false) : role === INVITE_ROLE;
  const inviteLabel = isEdit ? 'Resend invite' : 'Send invite';

  return (
    <form
      ref={formRef}
      id={formId}
      action={formAction}
      className={`${inDialog ? '' : 'panel '}people-form person-form`}
    >
      {person && <HiddenField name="id" value={person.id} />}
      <div className="people-form-grid">
        <TextField
          label="First name"
          isRequired
          name="givenName"
          defaultValue={person?.givenName}
          error={err('givenName')}
          autoComplete="off"
          maxLength={80}
          autoFocus={!inDialog}
        />
        <TextField
          label="Last name"
          isRequired={isEdit}
          name="familyName"
          defaultValue={person?.familyName}
          error={err('familyName')}
          autoComplete="off"
          maxLength={80}
        />
        {person && (
          <TextField
            label="Preferred name"
            name="preferredName"
            defaultValue={person.preferredName ?? undefined}
            error={err('preferredName')}
            hint="The name people use, if it is not the first name."
            autoComplete="off"
            maxLength={80}
          />
        )}
      </div>

      <div className="people-form-half">
        <DatePicker
          label="Date of birth"
          name="dateOfBirth"
          defaultValue={person ? (person.dateOfBirth ?? null) : undefined}
          error={err('dateOfBirth')}
          hint={
            isEdit
              ? 'Only used to tell whether someone is under 18. Leave blank to clear it.'
              : 'Only used to tell whether someone is under 18.'
          }
        />
        <TextField
          label="Phone"
          type="tel"
          name="phone"
          defaultValue={person?.phone ?? undefined}
          error={err('phone')}
          autoComplete="off"
          maxLength={32}
        />
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
                  {isEdit ? (
                    <input
                      type="checkbox"
                      name="roles"
                      value={option}
                      defaultChecked={person?.roles.includes(option)}
                    />
                  ) : (
                    <input
                      type="radio"
                      name="roles"
                      value={option}
                      checked={role === option}
                      onChange={() => undefined}
                      onClick={() => setRole(current => (current === option ? null : option))}
                    />
                  )}
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
        <div className="buxa:flex buxa:flex-wrap buxa:items-end buxa:gap-2">
          <div className="buxa:min-w-[14rem] buxa:flex-1">
            <TextField
              label="Email"
              type="email"
              name="email"
              defaultValue={person?.email ?? undefined}
              error={err('email')}
              autoComplete="off"
              maxLength={254}
            />
          </div>
          {inviteAvailable ? (
            <PersonInvite
              key={savedTeacher ? 'sent' : 'send'}
              label={inviteLabel}
              readDetails={() => personInviteDetails(formRef.current)}
              autoSend={savedTeacher}
            />
          ) : (
            <ComingSoonInvite label={inviteLabel} />
          )}
        </div>
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
            <div className="buxa:flex buxa:flex-wrap buxa:items-end buxa:gap-2">
              <div className="buxa:min-w-[14rem] buxa:flex-1">
                <TextField
                  label="Email"
                  type="email"
                  name="householdEmail"
                  error={err('householdEmail')}
                  hint="Kept with the household."
                  autoComplete="off"
                  maxLength={254}
                />
              </div>
              <ComingSoonInvite label="Send invite" />
            </div>
          )}
          {household && err('householdId') && (
            <p className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
              {err('householdId')}
            </p>
          )}
        </fieldset>
      )}

      {/* A pop-up's save posts dialog=1, so the action returns a success instead of redirecting to the person. */}
      {inDialog && <input type="hidden" name="dialog" value="1" />}
      <FormMessage state={state} />
      {!inDialog && (
        <div className="person-actions">
          <Button href={person ? personPath(person.id) : ROUTES.people}>Cancel</Button>
          {isEdit ? (
            <Button variant="primary" icon="save" disabled={pending}>
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
          ) : (
            <Button variant="primary" icon="plus" disabled={pending}>
              {pending ? 'Adding…' : 'Add person'}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
