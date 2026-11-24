'use client';

import { useActionState, useEffect } from 'react';
import { Dialog } from '@/components/components/Dialog';
import { Button } from '@/components/elements';
import { deleteSessionsAction } from '@/actions/classes';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { idleSessionDeletion, type SessionDeletionDone } from '@buxa/shared';
import { ActionMessage } from './ActionMessage';
import { SessionClassesDialog } from './SessionClassesDialog';

export interface SessionRef {
  id: string;
  name: string;
  /** How many classes the session holds. A session with classes is never deleted by a plain delete (see SessionClassesDialog). */
  classCount: number;
}

/**
 * The confirmation for deleting one session (the row's trash) or the selection (Delete selected). It names the count. The server
 * refuses a session that holds classes and deletes the rest; when the request finishes, `onDone` gets the result and the dialog
 * closes, so the list can show what was deleted and what was refused. A failure for the whole request stays in the dialog.
 * A single session that holds classes is not deleted here: the dialog offers archive, or delete its classes and the session.
 */
export function DeleteSessionsDialog({
  sessions,
  onDone,
  onClose,
}: {
  sessions: readonly SessionRef[];
  onDone: (result: SessionDeletionDone) => void;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(deleteSessionsAction, idleSessionDeletion);
  const { toast } = useUi();

  useEffect(() => {
    if (state.status === 'done') {
      onDone(state);
      onClose();
    }
  }, [state, onDone, onClose]);

  const count = sessions.length;
  const single = count === 1 ? sessions[0] : undefined;

  if (single && single.classCount > 0) {
    return (
      <SessionClassesDialog
        session={single}
        onArchived={message => {
          toast(message);
          onClose();
        }}
        onClose={onClose}
      />
    );
  }

  const formId = 'delete-sessions-form';
  const title = count === 1 ? 'Delete session?' : `Delete ${count} sessions?`;
  const body = single
    ? `${single.name} will be removed.`
    : `${count} sessions will be removed. A session with classes stays.`;

  return (
    <Dialog
      title={title}
      onClose={onClose}
      className="class-dialog"
      footer={
        <>
          <Button variant="glass" type="button" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="glass-danger" icon="trash" disabled={pending}>
            {pending ? 'Deleting...' : single ? 'Delete session' : 'Delete selected'}
          </Button>
        </>
      }
    >
      <form id={formId} action={formAction} className="class-form">
        {sessions.map(session => (
          <input key={session.id} type="hidden" name="sessionId" value={session.id} />
        ))}
        <p className="class-helper">{body}</p>
        {state.status === 'error' && <ActionMessage state={state} />}
      </form>
    </Dialog>
  );
}
