'use client';

import { useActionState } from 'react';
import { idle } from '@buxa/shared';
import { cancelEnrolmentAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';
import { Button } from '@/components/elements/export';
import { HiddenField } from '@/components/atoms';

/** Cancels one enrolment. The label names the camper, so a screen reader user knows which row the button belongs to. */
export function CancelEnrolmentButton({
  classId,
  enrolmentId,
  camperName,
}: {
  classId: string;
  enrolmentId: string;
  camperName: string;
}) {
  const [state, formAction, pending] = useActionState(cancelEnrolmentAction, idle);

  return (
    <form action={formAction} className="classes-inline">
      <HiddenField name="classId" value={classId} />
      <HiddenField name="enrolmentId" value={enrolmentId} />
      <Button variant="danger-soft" type="submit" icon="x" className="classes-target" disabled={pending}>
        Cancel enrolment<span className="sr-only"> for {camperName}</span>
      </Button>
      <ActionMessage state={state} />
    </form>
  );
}
