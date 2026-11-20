'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button } from '@/components/elements';
import { HiddenField, Select, TextField } from '@/components/atoms';
import { fieldError, idle } from '@buxa/shared';
import { enrolAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';

interface CamperChoice {
  id: string;
  name: string;
}

/**
 * Enrol one camper in one class. When the class is full only the waitlist button is offered: a full class never takes a
 * place. An override reason is shown to admins only (the service checks the permission again).
 */
export function EnrolForm({
  classId,
  campers,
  full,
  canOverride,
}: {
  classId: string;
  campers: readonly CamperChoice[];
  full: boolean;
  canOverride: boolean;
}) {
  const [state, formAction, pending] = useActionState(enrolAction, idle);
  const formRef = useRef<HTMLFormElement>(null);

  // A field error moves focus to the first invalid field, so the person can correct it without searching the page.
  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  const camperError = fieldError(state, 'camperId');
  const noCampers = campers.length === 0;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="panel stack classes-enrol"
      aria-label="Enrol a camper in this class"
    >
      <HiddenField name="classId" value={classId} />
      <Select
        label="Camper *"
        name="camperId"
        error={camperError}
        placeholder={noCampers ? 'No campers in the camp yet' : 'Choose a camper'}
        isDisabled={noCampers}
        options={campers.map(c => ({ value: c.id, label: c.name }))}
      />
      {canOverride && (
        <TextField
          label="Override reason (admins only)"
          name="overrideReason"
          error={fieldError(state, 'override')}
          hint="Needed only to place a camper who clashes with another session. The reason is kept in the audit log."
          maxLength={500}
          autoComplete="off"
        />
      )}
      <div className="classes-actions">
        {full ? (
          <p className="muted">This class is full. A camper can join the waitlist instead.</p>
        ) : (
          <Button
            variant="primary"
            type="submit"
            name="intent"
            value="enrol"
            icon="user-plus"
            className="classes-target"
            disabled={pending || noCampers}
          >
            Enrol camper
          </Button>
        )}
        <Button
          type="submit"
          name="intent"
          value="waitlist"
          variant={full ? 'primary' : 'secondary'}
          className="classes-target"
          disabled={pending || noCampers}
        >
          Add to waitlist
        </Button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}
