'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef } from 'react';
import { Field } from '@/components/ui';
import { classPath } from '@/config/routes';
import { fieldError, idle } from '@/lib/actions/state';
import { addSessionAction } from '../actions';
import { ActionMessage } from './ActionMessage';

export interface InstructorChoice { id: string; name: string }

/**
 * One session of a class. Times are typed in the camp's clock (the zone is shown above the fields). Instructors are chosen from the
 * people who have the instructor role; the class's ratio is shown, because it is stored on the class.
 */
export function NewSessionForm({ classId, className, defaultCapacity, timeZone, ratio, instructors }: {
  classId: string; className: string; defaultCapacity: number; timeZone: string;
  ratio: { instructors: number; campers: number } | null; instructors: readonly InstructorChoice[];
}) {
  const [state, formAction, pending] = useActionState(addSessionAction, idle);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  const err = (name: string) => fieldError(state, name);
  const invalid = (name: string) => (err(name) ? true : undefined);

  return (
    <form ref={formRef} action={formAction} className="panel stack classes-form" aria-describedby="session-form-help">
      <input type="hidden" name="classId" value={classId} />
      <p id="session-form-help" className="muted">
        Times are in the camp&apos;s time zone ({timeZone}), written as 2027-07-05T09:00. Fields marked with an asterisk are required.
      </p>
      <p className="muted">
        Class: <strong>{className}</strong>. Instructor ratio: {ratio ? `${ratio.instructors} instructor for ${ratio.campers} campers` : 'not set on this class'}.
      </p>
      <div className="form-row">
        <Field label="Starts *" error={err('startsAt')}>
          <input name="startsAt" placeholder="2027-07-05T09:00" autoComplete="off" aria-invalid={invalid('startsAt')} autoFocus />
        </Field>
        <Field label="Ends *" error={err('endsAt')}>
          <input name="endsAt" placeholder="2027-07-05T12:00" autoComplete="off" aria-invalid={invalid('endsAt')} />
        </Field>
      </div>
      <Field label="Location *" error={err('location')}>
        <input name="location" maxLength={200} autoComplete="off" aria-invalid={invalid('location')} />
      </Field>
      <Field label="Places" error={err('capacity')} hint={`Leave empty to use the class default (${defaultCapacity}).`}>
        <input name="capacity" inputMode="numeric" autoComplete="off" placeholder={String(defaultCapacity)} aria-invalid={invalid('capacity')} />
      </Field>
      <fieldset className="plain">
        <legend className="field-label">Instructors</legend>
        {instructors.length === 0 ? (
          <p className="muted">No one has the instructor role yet. Add them under People, then come back.</p>
        ) : (
          <div className="people-checks">
            {instructors.map(i => (
              <label key={i.id} className="people-check">
                <input type="checkbox" name="instructorIds" value={i.id} /> {i.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <ActionMessage state={state} />
      <div className="classes-actions">
        <button type="submit" className="btn btn-primary classes-target" disabled={pending}>{pending ? 'Saving...' : 'Add session'}</button>
        <Link className="btn btn-ghost classes-target" href={classPath(classId)}>Back to the class</Link>
      </div>
    </form>
  );
}
