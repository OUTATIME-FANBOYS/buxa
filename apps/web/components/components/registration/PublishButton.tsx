'use client';

import { useActionState } from 'react';
import { idle } from '@buxa/shared';
import { Button } from '@/components/elements';
import { publishFormAction } from '@/actions/registration';
import { ActionMessage } from '@/components/components/classes/forms';

/** Publishes the draft as the next version. Families and staff take registrations against the published version only. */
export function PublishButton({ formId, publishedVersion }: { formId: string; publishedVersion: number | null }) {
  const [state, formAction, pending] = useActionState(publishFormAction, idle);

  return (
    <form action={formAction} className="registration-publish">
      <input type="hidden" name="formId" value={formId} />
      <Button type="submit" variant="primary" icon="check" disabled={pending} className="classes-target">
        {pending ? 'Publishing...' : publishedVersion === null ? 'Publish form' : 'Publish a new version'}
      </Button>
      <ActionMessage state={state} />
    </form>
  );
}
