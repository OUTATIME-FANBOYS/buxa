'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import { Dialog } from '@/components/components/Dialog';
import { Button } from '@/components/elements';
import { deleteClassAction } from '@/actions/classes';
import { idle } from '@buxa/shared';
import { ActionMessage } from './ActionMessage';

/**
 * Deletes a class after a confirmation. A class with enrolments is refused by the server with the reason shown in the dialog,
 * and nothing is removed. The dialog closes when the class is deleted.
 */
export function DeleteClassButton({
  classId,
  sessionId,
  className,
}: {
  classId: string;
  sessionId: string;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const [state, formAction, pending] = useActionState(deleteClassAction, idle);

  useEffect(() => {
    if (state.status === 'success') {
      setOpen(false);
    }
  }, [state]);

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
        <Dialog title="Delete class?" onClose={close} className="class-dialog">
          <form action={formAction} className="class-form">
            <input type="hidden" name="classId" value={classId} />
            <input type="hidden" name="sessionId" value={sessionId} />
            <p className="class-helper">
              {className} will be removed from this session. A class with enrolments cannot be deleted: cancel them
              first.
            </p>
            <ActionMessage state={state} />
            <div className="classes-actions">
              <Button variant="glass" type="button" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="glass-danger" disabled={pending}>
                {pending ? 'Deleting...' : 'Delete class'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
