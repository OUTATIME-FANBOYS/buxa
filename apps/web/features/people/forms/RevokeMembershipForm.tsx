'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Field } from '@/components/ui';
import { fieldError, idle } from '@/lib/actions/state';
import { revokeMembershipAction } from '../actions';
import { FormMessage } from './FormMessage';

/** Revoke a membership. The reason is required: it is recorded with the revocation and in the audit log. */
export function RevokeMembershipForm({ membershipId, personId }: { membershipId: string; personId: string }) {
  const [state, formAction, pending] = useActionState(revokeMembershipAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);
  const reasonError = fieldError(state, 'reason');

  return (
    <form ref={formRef} action={formAction} className="stack people-subpanel">
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="personId" value={personId} />
      <Field label="Why is it being revoked? *" error={reasonError} hint="Recorded with the revocation.">
        <textarea name="reason" rows={2} maxLength={500} aria-invalid={reasonError ? true : undefined} />
      </Field>
      <FormMessage state={state} />
      <div><button className="btn btn-danger" disabled={pending}>{pending ? 'Revoking…' : 'Revoke membership'}</button></div>
    </form>
  );
}
