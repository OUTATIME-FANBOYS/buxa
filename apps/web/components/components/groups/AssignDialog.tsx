'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import type { Group, Room } from '@buxa/contracts';
import { fieldError, idle, RATIO_REFUSAL_KEY, type ActionState } from '@buxa/shared';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { assignAction } from '@/actions/groups';
import { FormPopUp } from '@/components/components';
import { Button } from '@/components/elements';
import { HiddenField, Select, TextField } from '@/components/atoms';

const FORM_ID = 'assign-form';
const OVERRIDE_FORM_ID = 'ratio-override-form';

export interface PersonChoice {
  id: string;
  name: string;
}

/** The people who can be placed (campers, and staff for the ratio) and the groups and rooms they can go into. */
export interface AssignChoices {
  sessionId: string;
  campers: readonly PersonChoice[];
  staff: readonly PersonChoice[];
  groups: readonly Group[];
  rooms: readonly Room[];
}

type Role = 'camper' | 'staff';

/** The choices the form has made. The override pop-up posts the same choices again, so they are kept here. */
interface Selection {
  role: Role;
  personId: string | null;
  groupId: string | null;
  roomId: string | null;
}

/**
 * The Place or move button. It opens the placement form: a person, their role, a group and a room. A refusal shows as small polite
 * text under the form. A ratio refusal opens a second pop-up that asks an admin for a reason, and only then places the person.
 */
export function AssignDialog({ choices }: { choices: AssignChoices }) {
  const [open, setOpen] = useState(false);
  const { toast } = useUi();
  const close = useCallback(() => setOpen(false), []);
  const done = useCallback(
    (message: string) => {
      toast(message);
      setOpen(false);
    },
    [toast],
  );

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        type="button"
        icon="user-plus"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Place or move
      </Button>
      {open && <AssignPopUp choices={choices} onCancel={close} onDone={done} />}
    </>
  );
}

export function AssignPopUp({
  choices,
  onCancel,
  onDone,
}: {
  choices: AssignChoices;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(assignAction, idle);
  const [selection, setSelection] = useState<Selection>({
    role: 'camper',
    personId: null,
    groupId: null,
    roomId: null,
  });
  const [overrideMessage, setOverrideMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'success') {
      onDone(state.message ?? 'Placed.');
    }
  }, [state, onDone]);

  // A ratio refusal is the one an admin can override: the pop-up asks for the reason.
  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors?.[RATIO_REFUSAL_KEY]) {
      setOverrideMessage(state.fieldErrors[RATIO_REFUSAL_KEY]);
    }
  }, [state]);

  const people = selection.role === 'camper' ? choices.campers : choices.staff;
  const noPeople = people.length === 0;
  const noGroups = choices.groups.length === 0;
  const noRooms = choices.rooms.length === 0;

  return (
    <>
      <FormPopUp
        title="Place or move a person"
        intro="Choose a person, a group and a room for this session. Capacity, age, the staff ratio and room use are checked when you place them."
        formId={FORM_ID}
        submitLabel="Place"
        pendingLabel="Placing..."
        submitIcon="user-plus"
        pending={pending}
        submitDisabled={noPeople || noGroups || noRooms}
        onCancel={onCancel}
      >
        <form ref={formRef} id={FORM_ID} action={formAction} className="stack">
          <HiddenField name="sessionId" value={choices.sessionId} />
          <Select
            label="Role"
            name="role"
            isRequired
            value={selection.role}
            options={[
              { value: 'camper', label: 'Camper' },
              { value: 'staff', label: 'Staff' },
            ]}
            onChange={value =>
              setSelection({ ...selection, role: value === 'staff' ? 'staff' : 'camper', personId: null })
            }
          />
          <Select
            label="Person"
            name="personId"
            isRequired
            value={selection.personId}
            error={fieldError(state, 'personId')}
            placeholder={noPeople ? 'No one with this role yet' : 'Choose a person'}
            isDisabled={noPeople}
            options={people.map(p => ({ value: p.id, label: p.name }))}
            onChange={personId => setSelection({ ...selection, personId })}
          />
          <Select
            label="Group"
            name="groupId"
            isRequired
            value={selection.groupId}
            error={fieldError(state, 'groupId')}
            placeholder={noGroups ? 'No groups yet' : 'Choose a group'}
            isDisabled={noGroups}
            options={choices.groups.map(g => ({
              value: g.id,
              label: `${g.name} (${g.campers}/${g.capacity} campers, ${g.staff} staff)`,
            }))}
            onChange={groupId => setSelection({ ...selection, groupId })}
          />
          <Select
            label="Room"
            name="roomId"
            isRequired
            value={selection.roomId}
            error={fieldError(state, 'roomId')}
            placeholder={noRooms ? 'No rooms yet' : 'Choose a room'}
            isDisabled={noRooms}
            options={choices.rooms.map(r => ({
              value: r.id,
              label: `${r.name}, ${r.location} (${r.campers}/${r.capacity} campers)`,
            }))}
            onChange={roomId => setSelection({ ...selection, roomId })}
          />
          <FormRefusal state={state} />
        </form>
      </FormPopUp>
      {overrideMessage !== null && (
        <RatioOverridePopUp
          selection={selection}
          sessionId={choices.sessionId}
          message={overrideMessage}
          onCancel={() => setOverrideMessage(null)}
          onDone={onDone}
        />
      )}
    </>
  );
}

/**
 * A refusal the form cannot pin to one field (a full group, a clash of rooms, a ratio): small text under the form, announced politely.
 * A ratio refusal is not shown here, because the override pop-up carries it.
 */
export function FormRefusal({ state }: { state: ActionState }) {
  if (state.status !== 'error' || state.fieldErrors?.[RATIO_REFUSAL_KEY]) {
    return null;
  }

  return (
    <p className="field-error" aria-live="polite">
      {state.message}
    </p>
  );
}

/** Asks an admin for the reason to place a person over a staff ratio. The reason is required and kept in the audit log. */
export function RatioOverridePopUp({
  selection,
  sessionId,
  message,
  onCancel,
  onDone,
}: {
  selection: Selection;
  sessionId: string;
  message: string;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(assignAction, idle);

  useEffect(() => {
    if (state.status === 'success') {
      onDone(state.message ?? 'Placed.');
    }
  }, [state, onDone]);

  return (
    <FormPopUp
      title="Override the staff ratio"
      intro={message}
      formId={OVERRIDE_FORM_ID}
      submitLabel="Place with override"
      pendingLabel="Placing..."
      submitIcon="user-plus"
      pending={pending}
      onCancel={onCancel}
    >
      <form id={OVERRIDE_FORM_ID} action={formAction} className="stack">
        <HiddenField name="sessionId" value={sessionId} />
        <HiddenField name="role" value={selection.role} />
        <HiddenField name="personId" value={selection.personId ?? ''} />
        <HiddenField name="groupId" value={selection.groupId ?? ''} />
        <HiddenField name="roomId" value={selection.roomId ?? ''} />
        <TextField
          label="Reason for the override"
          name="overrideReason"
          isRequired
          maxLength={500}
          autoComplete="off"
          error={
            fieldError(state, 'override') ?? (state.status === 'error' && !state.fieldErrors ? state.message : null)
          }
          hint="Say why the ratio can be broken, for example a staff member is on the way. It is kept in the audit log."
        />
      </form>
    </FormPopUp>
  );
}
