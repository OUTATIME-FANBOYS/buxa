'use client';

import { useActionState } from 'react';
import { idle } from '@buxa/shared';
import { Button } from '@/components/elements';
import { confirmRegistrationAction } from '@/actions/registration';
import { ActionMessage } from '@/components/components/classes/forms';

/** Confirms one pending registration. One tap: the confirmation is audited, and the row changes to confirmed on the next render. */
export function ConfirmRegistration({ formId, registrationId }: { formId: string; registrationId: string }) {
  const [state, formAction, pending] = useActionState(confirmRegistrationAction, idle);

  return (
    <form action={formAction}>
      <input type="hidden" name="formId" value={formId} />
      <input type="hidden" name="registrationId" value={registrationId} />
      <Button type="submit" variant="secondary" size="sm" icon="check" disabled={pending}>
        {pending ? 'Confirming...' : 'Confirm'}
      </Button>
      <ActionMessage state={state} />
    </form>
  );
}
