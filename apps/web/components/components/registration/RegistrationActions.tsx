'use client';

import { useActionState, useState } from 'react';
import { idle, type ActionState } from '@buxa/shared';
import { Button } from '@/components/elements';
import {
  archiveRegistrationAction,
  deleteRegistrationAction,
  unarchiveRegistrationAction,
  withdrawRegistrationAction,
} from '@/actions/registration';
import { ActionMessage } from '@/components/components/classes/forms';

type RegistrationAction = (previous: ActionState, form: FormData) => Promise<ActionState>;

/** One lifecycle step as a form. A step that cannot be undone asks again before it runs: the first tap shows what it will do. */
function Step({
  action,
  formId,
  registrationId,
  label,
  confirmLabel,
  warning,
  danger = false,
}: {
  action: RegistrationAction;
  formId: string;
  registrationId: string;
  label: string;
  /** When set, the first tap asks and the second runs the step. */
  confirmLabel?: string;
  warning?: string;
  danger?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, idle);
  const [asking, setAsking] = useState(false);

  return (
    <form action={formAction} className="registration-step">
      <input type="hidden" name="formId" value={formId} />
      <input type="hidden" name="registrationId" value={registrationId} />
      {asking && warning ? (
        <p className="class-helper" role="alert">
          {warning}
        </p>
      ) : null}
      <Button
        type={confirmLabel && !asking ? 'button' : 'submit'}
        variant={danger ? 'glass-danger' : 'secondary'}
        size="sm"
        disabled={pending}
        onClick={confirmLabel && !asking ? () => setAsking(true) : undefined}
      >
        {pending ? 'Working...' : asking && confirmLabel ? confirmLabel : label}
      </Button>
      {asking ? (
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setAsking(false)}>
          Cancel
        </Button>
      ) : null}
      <ActionMessage state={state} />
    </form>
  );
}

/**
 * What staff can do with a registration beyond confirming it. Withdraw releases its holds and cancels its enrolments but keeps the
 * record. Archive hides it from the lists and keeps it. Delete erases it and all its answers for good, and is offered to an admin
 * or the owner only (`canDelete`); a confirmed registration with enrolments must be withdrawn first, which the server enforces.
 */
export function RegistrationActions({
  formId,
  registrationId,
  status,
  archived,
  canDelete,
}: {
  formId: string;
  registrationId: string;
  status: 'pending' | 'confirmed' | 'withdrawn';
  archived: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="registration-actions">
      {status === 'withdrawn' ? null : (
        <Step
          action={withdrawRegistrationAction}
          formId={formId}
          registrationId={registrationId}
          label="Withdraw"
          confirmLabel="Confirm withdraw"
          warning="Withdrawing releases its holds and cancels its enrolments. The record is kept."
        />
      )}
      <Step
        action={archived ? unarchiveRegistrationAction : archiveRegistrationAction}
        formId={formId}
        registrationId={registrationId}
        label={archived ? 'Unarchive' : 'Archive'}
      />
      {canDelete ? (
        <Step
          action={deleteRegistrationAction}
          formId={formId}
          registrationId={registrationId}
          label="Delete"
          confirmLabel="Confirm delete"
          warning="Deleting erases this registration and all its answers. This cannot be undone. A confirmed registration with enrolments must be withdrawn first."
          danger
        />
      ) : null}
    </div>
  );
}
