'use client';

import { useActionState, useCallback, useState } from 'react';
import { Dialog } from '@/components/components/Dialog';
import { Button } from '@/components/elements';
import { deleteSessionAction } from '@/actions/classes';
import type { Session } from '@buxa/contracts';
import { idle } from '@buxa/shared';
import { ActionMessage } from './ActionMessage';
import { EditSessionForm } from './EditSessionForm';

/**
 * The session page's pencil button. It opens the Edit session dialog. Delete session is in the dialog's footer: the first click asks
 * for confirmation by naming the session, and a second click on Confirm delete deletes it. The server refuses a session that holds
 * classes, and the refusal is shown in the dialog. On success the server sends the user to the sessions list.
 */
export function EditSessionButton({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteState, deleteFormAction, deleting] = useActionState(deleteSessionAction, idle);
  const close = useCallback(() => {
    setOpen(false);
    setConfirming(false);
  }, []);
  const onPendingChange = useCallback((value: boolean) => setPending(value), []);
  const formId = `edit-session-${session.id}`;
  const deleteFormId = `delete-session-${session.id}`;

  return (
    <>
      <Button
        type="button"
        variant="glass"
        size="sm"
        iconOnly
        icon="edit"
        aria-label={`Edit ${session.name}`}
        title="Edit session"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      />
      {open && (
        <Dialog
          title="Edit session"
          onClose={close}
          className="class-dialog"
          footer={
            <>
              <Button
                type={confirming ? 'submit' : 'button'}
                form={confirming ? deleteFormId : undefined}
                variant="glass-danger"
                icon="trash"
                disabled={pending || deleting}
                onClick={confirming ? undefined : () => setConfirming(true)}
              >
                {deleting ? 'Deleting...' : confirming ? 'Confirm delete' : 'Delete session'}
              </Button>
              <span className="buxa:flex-1" />
              <Button variant="glass" type="button" disabled={pending || deleting} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" form={formId} variant="primary" icon="save" disabled={pending || deleting}>
                {pending ? 'Saving...' : 'Save session'}
              </Button>
            </>
          }
        >
          {confirming && (
            <p className="class-helper" role="alert">
              Delete &ldquo;{session.name}&rdquo;? This cannot be undone. A session with classes cannot be deleted.
            </p>
          )}
          <EditSessionForm session={session} formId={formId} onPendingChange={onPendingChange} onSaved={close} />
          <form id={deleteFormId} action={deleteFormAction} className="class-form">
            <input type="hidden" name="sessionId" value={session.id} />
          </form>
          <ActionMessage state={deleteState} />
        </Dialog>
      )}
    </>
  );
}
