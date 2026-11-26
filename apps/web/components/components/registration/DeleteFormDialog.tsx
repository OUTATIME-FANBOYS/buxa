'use client';

import { useActionState, useEffect } from 'react';
import type { RegistrationForm } from '@buxa/contracts';
import { idle } from '@buxa/shared';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { deleteFormAction } from '@/actions/registration';
import { ConfirmDialog } from '@/components/components/ConfirmDialog';
import { ActionMessage } from '@/components/components/classes/forms';

/**
 * Deletes a form with no registrations, after a confirmation that names it. The server checks the rule again and refuses a form with
 * registrations, with the reason shown here. The dialog closes and a toast says so when the form is deleted; the table then drops it.
 */
export function DeleteFormDialog({ form, onClose }: { form: RegistrationForm; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(deleteFormAction, idle);
  const { toast } = useUi();

  useEffect(() => {
    if (state.status === 'success') {
      toast(state.message ?? 'Form deleted.');
      onClose();
    }
  }, [state, toast, onClose]);

  return (
    <ConfirmDialog
      title="Delete form?"
      variant="danger"
      className="class-dialog"
      confirmLabel="Delete form"
      pendingLabel="Deleting..."
      pending={pending}
      onCancel={onClose}
      formId={`delete-form-${form.id}`}
      formAction={formAction}
      body={
        <>
          <input type="hidden" name="formId" value={form.id} />
          <p>
            <strong>{form.name}</strong> and its questions, its sessions and its files will be removed. This cannot be
            undone.
          </p>
          <ActionMessage state={state} />
        </>
      }
    />
  );
}
