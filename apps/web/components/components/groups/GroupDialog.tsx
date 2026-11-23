'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import type { Group } from '@buxa/contracts';
import { fieldError, idle } from '@buxa/shared';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { saveGroupAction } from '@/actions/groups';
import { FormPopUp } from '@/components/components';
import { Button } from '@/components/elements';
import { HiddenField, TextField } from '@/components/atoms';
import { ActionMessage } from '@/components/components/classes/forms';

const FORM_ID = 'group-form';

/**
 * The New group button, or the Edit button on a group's row. Both open the same pop-up form: name, capacity, the optional staff ratio
 * (campers per staff member) and the optional age range. A saved form closes the pop-up and toasts the server's message.
 */
export function GroupDialog({ sessionId, group }: { sessionId: string; group?: Group }) {
  const [open, setOpen] = useState(false);
  const { toast } = useUi();
  const close = useCallback(() => setOpen(false), []);
  const saved = useCallback(
    (message: string) => {
      toast(message);
      setOpen(false);
    },
    [toast],
  );

  return (
    <>
      {group ? (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          icon="edit"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          Edit<span className="sr-only"> {group.name}</span>
        </Button>
      ) : (
        <Button
          variant="glass"
          size="sm"
          type="button"
          icon="plus"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          New group
        </Button>
      )}
      {open && <GroupPopUp sessionId={sessionId} group={group} onCancel={close} onSaved={saved} />}
    </>
  );
}

function GroupPopUp({
  sessionId,
  group,
  onCancel,
  onSaved,
}: {
  sessionId: string;
  group?: Group;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(saveGroupAction, idle);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'success') {
      onSaved(state.message ?? 'Group saved.');
    }
  }, [state, onSaved]);

  // A field error moves focus to the first invalid field, so the person can correct it without searching the page.
  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  return (
    <FormPopUp
      title={group ? 'Edit group' : 'New group'}
      formId={FORM_ID}
      submitLabel={group ? 'Save group' : 'Add group'}
      pendingLabel="Saving..."
      submitIcon={group ? 'check' : 'plus'}
      pending={pending}
      onCancel={onCancel}
    >
      <form ref={formRef} id={FORM_ID} action={formAction} className="stack">
        <HiddenField name="sessionId" value={sessionId} />
        {group && <HiddenField name="groupId" value={group.id} />}
        <TextField
          label="Name"
          name="name"
          isRequired
          defaultValue={group?.name ?? ''}
          error={fieldError(state, 'name')}
          maxLength={120}
          autoComplete="off"
        />
        <TextField
          label="Capacity (campers)"
          name="capacity"
          isRequired
          inputMode="numeric"
          defaultValue={group ? String(group.capacity) : ''}
          error={fieldError(state, 'capacity')}
        />
        <TextField
          label="Staff ratio (campers per staff)"
          name="ratioCampers"
          inputMode="numeric"
          defaultValue={group?.ratioCampers ? String(group.ratioCampers) : ''}
          error={fieldError(state, 'ratioCampers')}
          hint="For 1:8, enter 8. Leave blank for no ratio."
        />
        <TextField
          label="Youngest age"
          name="ageMin"
          inputMode="numeric"
          defaultValue={group?.ageRange ? String(group.ageRange.minAge) : ''}
          error={fieldError(state, 'ageMin')}
          hint="Optional. The camper's age on the session's first day must be in the range."
        />
        <TextField
          label="Oldest age"
          name="ageMax"
          inputMode="numeric"
          defaultValue={group?.ageRange ? String(group.ageRange.maxAge) : ''}
          error={fieldError(state, 'ageMax')}
        />
        <ActionMessage state={state} />
      </form>
    </FormPopUp>
  );
}
