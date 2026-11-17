'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Field } from '@/components/elements/export';
import { fieldError, idle } from '@buxa/shared';
import { enrolAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';

export interface CamperChoice { id: string; name: string }

/**
 * Enrol one camper in one session. When the session is full only the waitlist button is offered: a full session never takes a
 * place. An override reason is shown to admins only (the service checks the permission again).
 */
export function EnrolForm({ classId, sessionId, campers, full, canOverride }: {
  classId: string; sessionId: string; campers: readonly CamperChoice[]; full: boolean; canOverride: boolean;
}) {
  const [state, formAction, pending] = useActionState(enrolAction, idle);
  const formRef = useRef<HTMLFormElement>(null);

  // A field error moves focus to the first invalid field, so the person can correct it without searching the page.
  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  const camperError = fieldError(state, 'camperId');
  const noCampers = campers.length === 0;

  return (
    <form ref={formRef} action={formAction} className="panel stack classes-enrol" aria-label="Enrol a camper in this session">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <Field label="Camper *" error={camperError}>
        <select name="camperId" defaultValue="" aria-invalid={camperError ? true : undefined} disabled={noCampers}>
          <option value="">{noCampers ? 'No campers in the camp yet' : 'Choose a camper'}</option>
          {campers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      {canOverride && (
        <Field label="Override reason (admins only)" error={fieldError(state, 'override')}
          hint="Needed only to place a camper who clashes with another session. The reason is kept in the audit log.">
          <input name="overrideReason" maxLength={500} autoComplete="off" />
        </Field>
      )}
      <div className="classes-actions">
        {full ? (
          <p className="muted">This session is full. A camper can join the waitlist instead.</p>
        ) : (
          <button type="submit" name="intent" value="enrol" className="btn btn-primary classes-target" disabled={pending || noCampers}>Enrol camper</button>
        )}
        <button type="submit" name="intent" value="waitlist" className={`btn classes-target ${full ? 'btn-primary' : ''}`} disabled={pending || noCampers}>
          Add to waitlist
        </button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}
