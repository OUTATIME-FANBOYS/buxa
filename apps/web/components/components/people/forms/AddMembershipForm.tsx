'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button } from '@/components/elements';
import { DatePicker, HiddenField, TextField } from '@/components/atoms';
import { fieldError, idle } from '@buxa/shared';
import { addMembershipAction } from '@/actions/people';
import { FormMessage } from './FormMessage';

/** A new membership: a plan name and a date range (camp-local days, both included). */
export function AddMembershipForm({ personId }: { personId: string }) {
  const [state, formAction, pending] = useActionState(addMembershipAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);
  const err = (name: string) => fieldError(state, name);

  return (
    <form ref={formRef} action={formAction} className="stack people-subpanel">
      <HiddenField name="personId" value={personId} />
      <h3 className="people-subheading">Add a membership</h3>
      {/* Every field has the same parts in the same order: label, input, helper line. The three share one row where they fit. */}
      <div className="people-form-grid people-membership-fields">
        <TextField
          label="Plan"
          name="plan"
          error={err('plan')}
          hint='For example "Summer 2027".'
          maxLength={80}
          autoComplete="off"
        />
        <DatePicker label="Starts on" name="startsOn" error={err('startsOn')} hint="The first camp day, included." />
        <DatePicker label="Ends on" name="endsOn" error={err('endsOn')} hint="The last camp day, included." />
      </div>
      <FormMessage state={state} />
      <div>
        <Button variant="primary" disabled={pending}>
          {pending ? 'Adding…' : 'Add membership'}
        </Button>
      </div>
    </form>
  );
}
