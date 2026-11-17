'use client';

import { useActionState } from 'react';
import { idle } from '@buxa/shared';
import { cancelEnrolmentAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';

/** Cancels one enrolment. The label names the camper, so a screen reader user knows which row the button belongs to. */
export function CancelEnrolmentButton({ classId, enrolmentId, camperName }: { classId: string; enrolmentId: string; camperName: string }) {
  const [state, formAction, pending] = useActionState(cancelEnrolmentAction, idle);
  return (
    <form action={formAction} className="classes-inline">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="enrolmentId" value={enrolmentId} />
      <button type="submit" className="btn btn-danger-ghost classes-target" disabled={pending}>
        Cancel enrolment<span className="sr-only"> for {camperName}</span>
      </button>
      <ActionMessage state={state} />
    </form>
  );
}
