'use client';

import { useActionState, useEffect, useState } from 'react';
import { idle, type ActionState } from '@buxa/shared';
import { Button } from '@/components/elements';
import { ConfirmDialog } from '@/components/components/ConfirmDialog';
import {
  archiveRegistrationAction,
  deleteRegistrationAction,
  unarchiveRegistrationAction,
  withdrawRegistrationAction,
} from '@/actions/registration';
import { ActionMessage } from '@/components/components/classes/forms';

type RegistrationAction = (previous: ActionState, form: FormData) => Promise<ActionState>;

/**
 * One lifecycle step as a form. A step with `confirmLabel` asks first: the tap opens a ConfirmDialog that shows the warning, and its
 * action runs the step. The dialog closes when the step succeeds; a failure stays in the dialog.
 */
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
  /** When set, the first tap asks in a dialog and its action runs the step. */
  confirmLabel?: string;
  warning?: string;
  danger?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, idle);
  const [asking, setAsking] = useState(false);
  const fields = (
    <>
      <input type="hidden" name="formId" value={formId} />
      <input type="hidden" name="registrationId" value={registrationId} />
    </>
  );

  useEffect(() => {
    if (state.status === 'success') {
      setAsking(false);
    }
  }, [state.status]);

  if (!confirmLabel) {
    return (
      <div className="registration-step">
        <form action={formAction}>
          {fields}
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            {pending ? 'Working...' : label}
          </Button>
        </form>
        <ActionMessage state={state} />
      </div>
    );
  }

  return (
    <div className="registration-step">
      <Button
        type="button"
        variant={danger ? 'glass-danger' : 'secondary'}
        size="sm"
        disabled={pending}
        onClick={() => setAsking(true)}
      >
        {pending ? 'Working...' : label}
      </Button>
      {asking && (
        <ConfirmDialog
          title={`${label} registration?`}
          variant={danger ? 'danger' : 'neutral'}
          confirmLabel={confirmLabel}
          pendingLabel="Working..."
          pending={pending}
          onCancel={() => setAsking(false)}
          formId={`registration-${registrationId}-${label.toLowerCase()}`}
          formAction={formAction}
          body={
            <>
              {fields}
              {warning && <p className="class-helper">{warning}</p>}
              <ActionMessage state={state} />
            </>
          }
        />
      )}
    </div>
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
