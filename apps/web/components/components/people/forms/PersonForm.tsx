'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import type { Person } from '@buxa/contracts';
import type { CampRole } from '@buxa/domain';
import { Button } from '@/components/elements';
import { DatePicker, HiddenField, TextField } from '@/components/atoms';
import { ROUTES, personPath } from '@/config/routes';
import { fieldError, idle, toHouseholdChoices, type HouseholdChoice } from '@buxa/shared';
import { createPersonAction, updatePersonAction } from '@/actions/people';
import { FormMessage } from './FormMessage';
import { ComingSoonInvite, PersonInvite, personInviteDetails } from './PersonInvite';
import { PersonHouseholdFields, type HouseholdTarget } from './PersonHouseholdFields';
import { PersonRoles } from './PersonRoles';
import { isFamilyRole } from './roleGroups';

/**
 * An instructor is a teacher at the camp, and the only role an invite can grant (the invite is for the teacher role). The invite
 * button and the sign-in hand-off are offered for this role only.
 */
const INVITE_ROLE: CampRole = 'instructor';

/**
 * The fields a person's details can change, as the form posts them. Contact fields and date of birth are only given to staff.
 * `households` is the person's current household(s), used to pre-fill the Household section when editing.
 */
export type EditablePerson = Pick<
  Person,
  'id' | 'givenName' | 'familyName' | 'preferredName' | 'roles' | 'dateOfBirth' | 'email' | 'phone' | 'households'
>;

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
  /** The camp's households, for the Existing household select. */
  households: readonly HouseholdChoice[];
}

/**
 * The one person form, in two modes. `create` adds a person: with `household` (from the guardian's page) the person joins that
 * household, otherwise the form offers the camp's households or a new one. `edit` changes a person's details, pre-filled from
 * `person`, including the person's household. The update does not move anyone between households yet, so the household fields
 * show the person's current household but do not change it on save.
 * Roles are one radio in both modes. Editing pre-selects the person's first role; any others are not kept on save (see the report
 * in the commit). The Household section shows for a family role in both modes.
 */
export type PersonFormProps = PersonFormCommon &
  ({ mode: 'create'; household: HouseholdTarget | null } | { mode: 'edit'; person: EditablePerson });

export function PersonForm(props: PersonFormProps) {
  const { variant = 'page', formId = 'person-form', onPendingChange, onSaved, households } = props;
  const isEdit = props.mode === 'edit';
  const person = props.mode === 'edit' ? props.person : null;
  const household = props.mode === 'create' ? props.household : null;

  const [state, formAction, pending] = useActionState(isEdit ? updatePersonAction : createPersonAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const inDialog = variant === 'dialog';
  // The one role the form holds. Editing pre-selects the person's first role; adding starts with none, so a role is required.
  // Selecting the chosen role again clears it.
  const [role, setRole] = useState<CampRole | null>(() => person?.roles[0] ?? null);
  const toggleRole = (option: CampRole) => setRole(current => (current === option ? null : option));

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
    // Only a new success matters; the roles are read at the moment it is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, onSaved]);

  const err = (name: string) => fieldError(state, name);
  // Editing shows the person's own email always; adding shows it once a role that is not a family role is chosen.
  const showOwnEmail = isEdit || (role !== null && !isFamilyRole(role));
  const showHousehold = role !== null && isFamilyRole(role);
  // Only an instructor gets the invite. Editing asks about the person's saved roles; adding asks about the role just chosen.
  const inviteAvailable = isEdit ? (person?.roles.includes(INVITE_ROLE) ?? false) : role === INVITE_ROLE;
  const inviteLabel = isEdit ? 'Resend invite' : 'Send invite';

  // The camp's households, plus the person's own household when the list does not carry it, so Edit shows what they belong to.
  const currentHouseholds = person ? toHouseholdChoices(person.households) : [];
  const choices = [...households, ...currentHouseholds.filter(c => !households.some(h => h.id === c.id))];
  const defaultHouseholdId = currentHouseholds[0]?.id ?? '';

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

      <PersonRoles selected={role} onToggle={toggleRole} error={err('roles')} />

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
        <PersonHouseholdFields
          household={household}
          choices={choices}
          defaultHouseholdId={defaultHouseholdId}
          showRelationship={!isEdit && role === 'camper'}
          err={err}
        />
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
