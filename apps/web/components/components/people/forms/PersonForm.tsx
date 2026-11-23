'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import type { Person } from '@buxa/contracts';
import { isPlausibleEmail } from '@buxa/contracts';
import { isAllowedRoleSet, type CampRole } from '@buxa/domain';
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
 * `person`, including the person's household: the household select starts on it, and saving moves, creates or leaves it.
 * Roles are checkboxes in both modes, and every checked role is saved. Which email fields show depends on the roles: a family role
 * shows Household email (and no Email); a staff or participant role shows Email; both show both.
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
  // The roles the form holds. Editing starts from the person's roles; adding starts with none, so a role is required.
  const [roles, setRoles] = useState<ReadonlySet<CampRole>>(() => new Set(person?.roles ?? []));
  const toggleRole = (option: CampRole) =>
    setRoles(current => {
      const next = new Set(current);
      if (next.has(option)) {
        next.delete(option);
      } else {
        next.add(option);
      }

      return next;
    });
  // The personal email, held so the invite button can wait for a valid address.
  const [email, setEmail] = useState(person?.email ?? '');

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
      const teacher = !isEdit && roles.has(INVITE_ROLE);
      setSavedTeacher(teacher);
      onSaved?.(state.message ?? (isEdit ? 'Changes saved.' : 'Person added.'), teacher);
    }
    // Only a new success matters; the roles are read at the moment it is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, onSaved]);

  const err = (name: string) => fieldError(state, name);
  const selectedRoles = [...roles];
  const hasFamilyRole = selectedRoles.some(isFamilyRole);
  const showHousehold = hasFamilyRole;
  // One email for the person. A family role names it Household email; the label is the only difference.
  const emailLabel = hasFamilyRole ? 'Household email' : 'Email';
  // Editing a saved set that is not allowed (legacy data) blocks the save until the roles are changed to an allowed set.
  const roleSetInvalid = selectedRoles.length > 0 && !isAllowedRoleSet(selectedRoles);
  const blockSave = isEdit && roleSetInvalid;
  // The invite is for a teacher only. It is enabled once the email beside it is a valid address.
  const inviteAvailable = roles.has(INVITE_ROLE);
  const inviteEnabled = isPlausibleEmail(email.trim());
  const inviteLabel = isEdit ? 'Resend invite' : 'Send invite';

  // The camp's households, plus the person's own household when the list does not carry it, so Edit shows what they belong to.
  const currentHouseholds = person ? toHouseholdChoices(person.households) : [];
  const choices = [...households, ...currentHouseholds.filter(c => !households.some(h => h.id === c.id))];
  const defaultHouseholdId = currentHouseholds[0]?.id ?? '';
  const defaultRelationship =
    person?.households[0]?.members.find(m => m.personId === person.id)?.relationship ?? undefined;

  return (
    <form
      ref={formRef}
      id={formId}
      action={formAction}
      // A pop-up's footer submits by formId, so the block is enforced here as well as on the in-page button.
      onSubmit={event => {
        if (blockSave) {
          event.preventDefault();
        }
      }}
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

      <PersonRoles
        selected={roles}
        onToggle={toggleRole}
        error={err('roles')}
        notice={blockSave ? "This person's roles don't match the rules. Change them to save." : undefined}
      />

      <div className="buxa:flex buxa:flex-wrap buxa:items-end buxa:gap-2">
        <div className="buxa:min-w-[14rem] buxa:flex-1">
          <TextField
            label={emailLabel}
            type="email"
            name="email"
            value={email}
            onChange={setEmail}
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
            disabled={!inviteEnabled}
          />
        ) : (
          <ComingSoonInvite label={inviteLabel} />
        )}
      </div>

      {showHousehold && (
        <PersonHouseholdFields
          household={household}
          choices={choices}
          defaultHouseholdId={defaultHouseholdId}
          // Editing always shows it: a move to another household needs one, and it is pre-filled with the current one.
          showRelationship={isEdit || roles.has('camper')}
          defaultRelationship={defaultRelationship}
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
            <Button variant="primary" icon="save" disabled={pending || blockSave}>
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
