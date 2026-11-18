'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button } from '@/components/elements';
import { Checkbox, HiddenField, TextField } from '@/components/atoms';
import { classPath } from '@/config/routes';
import { fieldError, idle } from '@buxa/shared';
import { addSessionAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';

interface InstructorChoice {
  id: string;
  name: string;
}

/**
 * One session of a class. Times are typed in the camp's clock (the zone is shown above the fields). Instructors are chosen from the
 * people who have the instructor role; the class's ratio is shown, because it is stored on the class.
 */
export function NewSessionForm({
  classId,
  className,
  defaultCapacity,
  timeZone,
  ratio,
  instructors,
}: {
  classId: string;
  className: string;
  defaultCapacity: number;
  timeZone: string;
  ratio: { instructors: number; campers: number } | null;
  instructors: readonly InstructorChoice[];
}) {
  const [state, formAction, pending] = useActionState(addSessionAction, idle);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  const err = (name: string) => fieldError(state, name);

  return (
    <form ref={formRef} action={formAction} className="panel stack classes-form" aria-describedby="session-form-help">
      <HiddenField name="classId" value={classId} />
      <p id="session-form-help" className="muted">
        Times are in the camp&apos;s time zone ({timeZone}), written as 2027-07-05T09:00. Fields marked with an asterisk
        are required.
      </p>
      <p className="muted">
        Class: <strong>{className}</strong>. Instructor ratio:{' '}
        {ratio ? `${ratio.instructors} instructor for ${ratio.campers} campers` : 'not set on this class'}.
      </p>
      <div className="form-row">
        <TextField
          label="Starts *"
          name="startsAt"
          placeholder="2027-07-05T09:00"
          error={err('startsAt')}
          autoComplete="off"
          autoFocus
        />
        <TextField
          label="Ends *"
          name="endsAt"
          placeholder="2027-07-05T12:00"
          error={err('endsAt')}
          autoComplete="off"
        />
      </div>
      <TextField label="Location *" name="location" error={err('location')} maxLength={200} autoComplete="off" />
      <TextField
        label="Places"
        name="capacity"
        inputMode="numeric"
        placeholder={String(defaultCapacity)}
        error={err('capacity')}
        hint={`Leave empty to use the class default (${defaultCapacity}).`}
        autoComplete="off"
      />
      <fieldset className="plain">
        <legend className="field-label">Instructors</legend>
        {instructors.length === 0 ? (
          <p className="muted">No one has the instructor role yet. Add them under People, then come back.</p>
        ) : (
          <div className="people-checks">
            {instructors.map(i => (
              <Checkbox key={i.id} className="people-check" name="instructorIds" value={i.id}>
                {i.name}
              </Checkbox>
            ))}
          </div>
        )}
      </fieldset>
      <ActionMessage state={state} />
      <div className="classes-actions">
        <Button variant="primary" type="submit" className="classes-target" disabled={pending}>
          {pending ? 'Saving...' : 'Add session'}
        </Button>
        <Button variant="ghost" className="classes-target" href={classPath(classId)}>
          Back to the class
        </Button>
      </div>
    </form>
  );
}
