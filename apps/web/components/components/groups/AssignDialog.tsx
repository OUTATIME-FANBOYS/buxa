'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import type { Group, Room } from '@buxa/contracts';
import { fieldError, idle, RATIO_REFUSAL_KEY, ratioPersonIds, refusedPersonIds, type ActionState } from '@buxa/shared';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { assignAction } from '@/actions/groups';
import { FormPopUp } from '@/components/components';
import { Button } from '@/components/elements';
import { HiddenField, Select, TextField } from '@/components/atoms';
import { PersonPicker } from './PersonPicker';

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

/** The choices the form has made: the people (one or more), one group and one room. The override pop-up posts the same choices again. */
export interface Selection {
  role: Role;
  personIds: string[];
  groupId: string | null;
  roomId: string | null;
}

/** A ratio refusal the admin may override: the message, and the people it applies to. */
interface OverrideRequest {
  message: string;
  personIds: string[];
}

/**
 * The Place or move button. It opens the placement form: one or more people, their role, a group and a room. A refusal shows as small
 * polite text under the form, and names each person refused. A ratio refusal opens a second pop-up that asks an admin for a reason,
 * and only then places those people.
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
  presetPersonId,
  onCancel,
  onDone,
}: {
  choices: AssignChoices;
  /** A camper chosen before the pop-up opens (from a row's Place button). Still editable: the person picker can change it. */
  presetPersonId?: string;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(assignAction, idle);
  const [selection, setSelection] = useState<Selection>({
    role: 'camper',
    personIds: presetPersonId ? [presetPersonId] : [],
    groupId: null,
    roomId: null,
  });
  const [override, setOverride] = useState<OverrideRequest | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'success') {
      onDone(state.message ?? 'Placed.');
    }
  }, [state, onDone]);

  // After a refusal, only the people who were refused stay chosen: the others are placed and must not be posted again.
  // A ratio refusal is the one an admin can override: the pop-up asks for the reason, for those people only.
  useEffect(() => {
    if (state.status !== 'error') {
      return;
    }
    const refused = refusedPersonIds(state.fieldErrors);
    if (refused.length > 0) {
      setSelection(current => ({ ...current, personIds: refused }));
    }
    const ratioMessage = state.fieldErrors?.[RATIO_REFUSAL_KEY];
    if (ratioMessage) {
      setOverride({ message: ratioMessage, personIds: ratioPersonIds(state.fieldErrors) });
    }
  }, [state]);

  const people = selection.role === 'camper' ? choices.campers : choices.staff;
  const noPeople = people.length === 0;
  const noGroups = choices.groups.length === 0;
  const noRooms = choices.rooms.length === 0;

  const changeRole = (value: string | null) => {
    const role: Role = value === 'staff' ? 'staff' : 'camper';
    const nextPeople = role === 'camper' ? choices.campers : choices.staff;
    setSelection({
      ...selection,
      role,
      personIds: selection.personIds.filter(id => nextPeople.some(p => p.id === id)),
    });
  };

  return (
    <>
      <FormPopUp
        title="Place or move a person"
        intro="Choose one or more people, a group and a room for this session. Capacity, age, the staff ratio and room use are checked for each person when you place them."
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
            onChange={changeRole}
          />
          <PersonPicker
            label="Person"
            people={people}
            chosen={selection.personIds}
            error={fieldError(state, 'personId')}
            onChange={personIds => setSelection({ ...selection, personIds })}
          />
          {selection.personIds.map(id => (
            <input key={id} type="hidden" name="personId" value={id} />
          ))}
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
      {override !== null && (
        <RatioOverridePopUp
          selection={selection}
          sessionId={choices.sessionId}
          message={override.message}
          personIds={override.personIds}
          onCancel={() => setOverride(null)}
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

/**
 * Asks an admin for the reason to place the refused people over a staff ratio. The reason is required and kept in the audit log, and
 * it is posted only for the people the ratio refused.
 */
export function RatioOverridePopUp({
  selection,
  sessionId,
  message,
  personIds,
  onCancel,
  onDone,
}: {
  selection: Selection;
  sessionId: string;
  message: string;
  personIds: readonly string[];
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
        {personIds.map(id => (
          <HiddenField key={id} name="personId" value={id} />
        ))}
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
