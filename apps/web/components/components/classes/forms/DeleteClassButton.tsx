'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/components/ConfirmDialog';
import { Button } from '@/components/elements';
import { deleteSeriesAction } from '@/actions/classes';
import { idle } from '@buxa/shared';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { ActionMessage } from './ActionMessage';

const FORM_ID = 'delete-class-form';

/**
 * Deletes a class after a confirmation. A class with enrolments is refused by the server with the reason shown in the dialog,
 * and nothing is removed. The dialog closes when the class is deleted.
 */
export function DeleteClassButton({
  seriesId,
  sessionId,
  className,
}: {
  /** The class series to delete: every day of it goes with it. */
  seriesId: string;
  sessionId: string;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const [state, formAction, pending] = useActionState(deleteSeriesAction, idle);

  const { toast } = useUi();
  useEffect(() => {
    if (state.status === 'success') {
      toast(state.message ?? 'Class deleted.');
      setOpen(false);
    }
  }, [state, toast]);

  return (
    <>
      <Button
        type="button"
        variant="glass-danger"
        size="sm"
        iconOnly
        icon="trash"
        aria-label={`Delete ${className}`}
        title="Delete class"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      />
      {open && (
        <ConfirmDialog
          title="Delete class?"
          variant="danger"
          className="class-dialog"
          confirmLabel="Delete class"
          pendingLabel="Deleting..."
          pending={pending}
          onCancel={close}
          formId={FORM_ID}
          formAction={formAction}
          body={
            <>
              <input type="hidden" name="seriesId" value={seriesId} />
              <input type="hidden" name="sessionId" value={sessionId} />
              <p className="class-helper">
                {className} and every one of its days will be removed from this session. A class with enrolments cannot
                be deleted: cancel them first.
              </p>
              <ActionMessage state={state} />
            </>
          }
        />
      )}
    </>
  );
}
