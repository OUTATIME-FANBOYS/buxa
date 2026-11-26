'use client';

import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Person } from '@buxa/contracts';
import { EMAIL_MESSAGE, PHONE_NUMBER_MESSAGE, isPlausibleEmail, isValidPhone } from '@buxa/contracts';
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
  'id' | 'givenName' | 'familyName' | 'roles' | 'dateOfBirth' | 'email' | 'phone' | 'households'
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
 * Roles are checkboxes in both modes, and every checked role is saved.
 *
 * The person's details are first name and last name, then date of birth beside the phone. A camper's section is headed Camper details;
 * for any other role the heading is for screen readers only. A family role (a camper or a parent or guardian) shows the Parent or
 * guardian section: the household email and the household. Date of birth and phone are required, on add and on edit. Email is optional, but one that is typed must be a valid address. The emergency contact is not entered here: it is on the
 * person's page.
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
  // The form's own checks on the phone and email, shown on blur and on submit. The server refuses the same values with the same messages.
  const [problems, setProblems] = useState<{ phone?: string; email?: string }>({});

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
  const camper = roles.has('camper');
  const hasFamilyRole = selectedRoles.some(isFamilyRole);
  const showParent = hasFamilyRole;
  // Date of birth and phone are required for every person, on add and on edit: a blank one gets its message.
  const phoneProblem = (value: string): string | undefined =>
    isValidPhone(value.trim()) ? undefined : PHONE_NUMBER_MESSAGE;
  const emailProblem = (value: string): string | undefined => {
    const trimmed = value.trim();

    return trimmed === '' || isPlausibleEmail(trimmed) ? undefined : EMAIL_MESSAGE;
  };
  // Submit checks the phone and email as typed. The first invalid field takes focus, the phone before the email.
  const checkOnSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (blockSave) {
      event.preventDefault();

      return;
    }
    const data = new FormData(event.currentTarget);
    const phoneValue = data.get('phone');
    const next = {
      phone: phoneProblem(typeof phoneValue === 'string' ? phoneValue : ''),
      email: emailProblem(email),
    };
    setProblems(next);
    if (next.phone || next.email) {
      event.preventDefault();
      const first = event.currentTarget.elements.namedItem(next.phone ? 'phone' : 'email');
      if (first instanceof HTMLElement) {
        first.focus();
      }
    }
  };
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

  const emailRow = (
    <div className="buxa:flex buxa:flex-wrap buxa:items-end buxa:gap-2">
      <div className="buxa:min-w-[14rem] buxa:flex-1">
        <TextField
          label={emailLabel}
          type="email"
          name="email"
          value={email}
          onChange={value => {
            setEmail(value);
            setProblems(current => ({ ...current, email: undefined }));
          }}
          error={problems.email ?? err('email')}
          inputProps={{
            onBlur: event => setProblems(current => ({ ...current, email: emailProblem(event.currentTarget.value) })),
          }}
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
  );

  const phoneField = (
    <TextField
      label="Phone"
      type="tel"
      name="phone"
      defaultValue={person?.phone ?? undefined}
      error={problems.phone ?? err('phone')}
      isRequired
      inputProps={{
        onBlur: event => setProblems(current => ({ ...current, phone: phoneProblem(event.currentTarget.value) })),
      }}
      autoComplete="off"
      maxLength={32}
    />
  );

  // The hint sits under the whole row, so a taller hint never pushes the phone field away from the date field.
  const dateOfBirthHint = 'Only used to tell whether someone is under 18.';

  const dateOfBirthField = (
    <DatePicker
      label="Date of birth"
      name="dateOfBirth"
      isRequired
      defaultValue={person ? (person.dateOfBirth ?? null) : undefined}
      error={err('dateOfBirth')}
    />
  );

  return (
    <form
      ref={formRef}
      id={formId}
      action={formAction}
      // The browser's own required bubble is off: the form's submit check and the server show each message under its field.
      noValidate
      // A pop-up's footer submits by formId, so the block is enforced here as well as on the in-page button.
      onSubmit={checkOnSubmit}
      className={`${inDialog ? '' : 'panel '}people-form person-form`}
    >
      {person && <HiddenField name="id" value={person.id} />}

      <fieldset className="plain person-section buxa:border-0 buxa:p-0 buxa:m-0 buxa:min-w-0 buxa:grid buxa:gap-[var(--s4)]">
        {/* The heading is for a camper only. Other roles keep the group name for screen readers, with no visible heading. */}
        <legend className={camper ? 'person-legend' : 'person-legend sr-only'}>
          {camper ? 'Camper details' : 'Person details'}
        </legend>
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
        </div>
        <div className="form-pair">
          {dateOfBirthField}
          {phoneField}
        </div>
        <p className="muted">{dateOfBirthHint}</p>
      </fieldset>

      <PersonRoles
        selected={roles}
        onToggle={toggleRole}
        error={err('roles')}
        notice={blockSave ? "This person's roles don't match the rules. Change them to save." : undefined}
      />

      {!showParent && emailRow}

      {showParent && (
        <fieldset className="plain person-section buxa:border-0 buxa:p-0 buxa:m-0 buxa:min-w-0 buxa:grid buxa:gap-[var(--s4)]">
          <legend className="person-legend">Parent or guardian</legend>
          <p className="person-helper">
            The family&apos;s parent or guardian. For a parent or guardian, the name above is their own. A camper joins
            a household that already has one.
          </p>
          {emailRow}
          <PersonHouseholdFields
            household={household}
            choices={choices}
            defaultHouseholdId={defaultHouseholdId}
            // Editing always shows it: a move to another household needs one, and it is pre-filled with the current one.
            showRelationship={isEdit || camper}
            defaultRelationship={defaultRelationship}
            err={err}
          />
        </fieldset>
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
