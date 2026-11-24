'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import { FormPopUp } from '@/components/components';
import { Button } from '@/components/elements';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { publishSessionAction, setSessionArchivedAction } from '@/actions/classes';
import type { Session } from '@buxa/contracts';
import { idle } from '@buxa/shared';
import { ActionMessage } from './ActionMessage';
import { SESSION_STATUS } from '../sessionStatus';
import { EditSessionForm } from './EditSessionForm';

/**
 * The session page's pencil button. It opens the Edit session dialog. Deleting a session is not offered here: the sessions table's
 * trash icon owns it, with its prompt that lists what goes with the session. The dialog's footer holds Unarchive on the left (an admin
 * or the owner, `canUnarchive`, for an archived session), and Cancel and Save on the right. A draft session is taken live from the body
 * by an admin or the owner (`canPublish`). On a successful unarchive or publish, the dialog closes and a toast shows the server's message.
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
  const [pending, setPending] = useState(false);
  const [unarchiveState, unarchiveAction, unarchiving] = useActionState(setSessionArchivedAction, idle);
  const [publishState, publishAction, publishing] = useActionState(publishSessionAction, idle);
  const close = useCallback(() => setOpen(false), []);
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
          pending={pending || unarchiving || publishing}
          onCancel={close}
          leading={
            session.status === 'archived' && canUnarchive ? (
              <form action={unarchiveAction} className="class-form">
                <input type="hidden" name="sessionId" value={session.id} />
                <input type="hidden" name="archived" value="0" />
                <Button type="submit" variant="glass" disabled={unarchiving}>
                  {unarchiving ? 'Unarchiving...' : 'Unarchive session'}
                </Button>
              </form>
            ) : session.status === 'draft' && canPublish ? (
              <form action={publishAction} className="class-form">
                <input type="hidden" name="sessionId" value={session.id} />
                <Button type="submit" variant="glass" icon="check" disabled={publishing}>
                  {publishing ? 'Going live...' : 'Go live'}
                </Button>
              </form>
            ) : undefined
          }
        >
          <p className="class-helper" data-testid="session-status-note">
            {SESSION_STATUS[session.status].note}
          </p>
          <EditSessionForm session={session} formId={formId} onPendingChange={onPendingChange} onSaved={saved} />
          <ActionMessage state={unarchiveState} />
          <ActionMessage state={publishState} />
        </FormPopUp>
      )}
    </>
  );
}
