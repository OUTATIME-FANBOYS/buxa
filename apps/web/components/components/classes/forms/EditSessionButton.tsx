'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import { FormPopUp } from '@/components/components';
import { Button } from '@/components/elements';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { deleteSessionAction, publishSessionAction, setSessionArchivedAction } from '@/actions/classes';
import type { Session } from '@buxa/contracts';
import { idle } from '@buxa/shared';
import { ActionMessage } from './ActionMessage';
import { SESSION_STATUS } from '../sessionStatus';
import { EditSessionForm } from './EditSessionForm';
import { SessionClassesDialog } from './SessionClassesDialog';

/**
 * The session page's pencil button. It opens the Edit session dialog. A session with no classes is deleted from the dialog's footer:
 * the first click asks for confirmation by naming the session, and a second click on Confirm delete deletes it. A session with classes
 * is never deleted this way: its button opens the archive-or-delete prompt instead. An archived session can be unarchived here by an
 * admin or the owner (`canUnarchive`), and a draft session is taken live there by an admin or the owner (`canPublish`). On success the
 * server sends the user to the sessions list.
 */
export function EditSessionButton({
  session,
  canUnarchive = false,
  canPublish = false,
}: {
  session: Session;
  canUnarchive?: boolean;
  /** Admin and owner (classes:publish) see Go live on a draft session. */
  canPublish?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteState, deleteFormAction, deleting] = useActionState(deleteSessionAction, idle);
  const [unarchiveState, unarchiveAction, unarchiving] = useActionState(setSessionArchivedAction, idle);
  const [publishState, publishAction, publishing] = useActionState(publishSessionAction, idle);
  const close = useCallback(() => {
    setOpen(false);
    setConfirming(false);
  }, []);
  const { toast } = useUi();
  // A saved session closes the pop-up and toasts the server's message.
  const saved = useCallback(
    (message: string) => {
      toast(message);
      close();
    },
    [toast, close],
  );
  useEffect(() => {
    if (unarchiveState.status === 'success') {
      saved(unarchiveState.message ?? 'Session unarchived.');
    }
  }, [unarchiveState, saved]);
  useEffect(() => {
    if (publishState.status === 'success') {
      saved(publishState.message ?? 'Session is live.');
    }
  }, [publishState, saved]);
  const onPendingChange = useCallback((value: boolean) => setPending(value), []);
  const formId = `edit-session-${session.id}`;
  const deleteFormId = `delete-session-${session.id}`;
  // A session with classes, and any draft, is deleted from the prompt that lists what goes with it; an empty live session is deleted here.
  const hasClasses = session.classCount > 0 || session.status === 'draft';

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
        <FormPopUp
          title="Edit session"
          formId={formId}
          submitLabel="Save session"
          pendingLabel="Saving..."
          submitIcon="save"
          pending={pending || deleting || unarchiving || publishing}
          onCancel={close}
          leading={
            hasClasses ? (
              <Button
                type="button"
                variant="glass-danger"
                icon="trash"
                disabled={pending || deleting}
                onClick={() => {
                  close();
                  setChoosing(true);
                }}
              >
                Delete session
              </Button>
            ) : (
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
            )
          }
        >
          <p className="class-helper" data-testid="session-status-note">
            {SESSION_STATUS[session.status].note}
          </p>
          {session.status === 'draft' && canPublish && (
            <form action={publishAction} className="class-form">
              <input type="hidden" name="sessionId" value={session.id} />
              <Button type="submit" variant="glass" icon="check" disabled={publishing}>
                {publishing ? 'Going live...' : 'Go live'}
              </Button>
            </form>
          )}
          {session.status === 'archived' && canUnarchive && (
            <form action={unarchiveAction} className="class-form">
              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="archived" value="0" />
              <Button type="submit" variant="glass" disabled={unarchiving}>
                {unarchiving ? 'Unarchiving...' : 'Unarchive session'}
              </Button>
            </form>
          )}
          {confirming && (
            <p className="class-helper" role="alert">
              Delete &ldquo;{session.name}&rdquo;? This cannot be undone.
            </p>
          )}
          <EditSessionForm session={session} formId={formId} onPendingChange={onPendingChange} onSaved={saved} />
          <form id={deleteFormId} action={deleteFormAction} className="class-form">
            <input type="hidden" name="sessionId" value={session.id} />
          </form>
          <ActionMessage state={deleteState} />
          <ActionMessage state={unarchiveState} />
          <ActionMessage state={publishState} />
        </FormPopUp>
      )}
      {choosing && (
        <SessionClassesDialog
          session={session}
          onArchived={message => {
            toast(message);
            setChoosing(false);
          }}
          onClose={() => setChoosing(false)}
        />
      )}
    </>
  );
}
