'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Field } from '@/components/ui';
import { fieldError, idle } from '@/lib/actions/state';
import { addMembershipAction } from '../actions';
import { FormMessage } from './FormMessage';

/** A new membership: a plan name and a date range (camp-local days, both included). */
export function AddMembershipForm({ personId }: { personId: string }) {
  const [state, formAction, pending] = useActionState(addMembershipAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);
  const err = (name: string) => fieldError(state, name);

  return (
    <form ref={formRef} action={formAction} className="stack people-subpanel">
      <input type="hidden" name="personId" value={personId} />
      <h3 className="people-subheading">Add a membership</h3>
      <div className="people-form-grid">
        <Field label="Plan" error={err('plan')} hint='For example "Summer 2027".'>
          <input name="plan" maxLength={80} autoComplete="off" aria-invalid={err('plan') ? true : undefined} />
        </Field>
        <Field label="Starts on" error={err('startsOn')}>
          <input type="date" name="startsOn" aria-invalid={err('startsOn') ? true : undefined} />
        </Field>
        <Field label="Ends on" error={err('endsOn')}>
          <input type="date" name="endsOn" aria-invalid={err('endsOn') ? true : undefined} />
        </Field>
      </div>
      <FormMessage state={state} />
      <div><button className="btn" disabled={pending}>{pending ? 'Adding…' : 'Add membership'}</button></div>
    </form>
  );
}
