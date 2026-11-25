'use client';

import { useActionState } from 'react';
import { fieldError, idle } from '@buxa/shared';
import { Button, TextField } from '@/components/elements';
import { recordPaymentAction } from '@/actions/registration';
import { ActionMessage } from '@/components/components/classes/forms';

/*
 * Staff record by hand how one child's place in a class was paid. Nothing is charged here: online payment is a later phase. Marking a
 * place paid needs a note saying how (the server checks it too). Marking it unpaid again needs no note.
 */
export function RecordPayment({
  formId,
  registrationClassId,
  paid,
}: {
  formId: string;
  registrationClassId: string;
  paid: boolean;
}) {
  const [state, formAction, pending] = useActionState(recordPaymentAction, idle);

  return (
    <form action={formAction} className="registration-payment">
      <input type="hidden" name="formId" value={formId} />
      <input type="hidden" name="registrationClassId" value={registrationClassId} />
      <input type="hidden" name="paid" value={paid ? 'no' : 'yes'} />
      {paid ? null : (
        <TextField
          className="registration-payment__note"
          label="How it was paid"
          name="note"
          isRequired
          maxLength={500}
          autoComplete="off"
          error={fieldError(state, 'note')}
        />
      )}
      <Button type="submit" variant={paid ? 'ghost' : 'secondary'} size="sm" disabled={pending}>
        {pending ? 'Saving...' : paid ? 'Mark unpaid' : 'Mark paid'}
      </Button>
      <ActionMessage state={state} />
    </form>
  );
}
