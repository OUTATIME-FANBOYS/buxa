'use client';

import { useActionState, useEffect, useState } from 'react';
import { Dialog } from '@/components/components/Dialog';
import { Button } from '@/components/elements';
import { TextField } from '@/components/atoms';
import { deleteSessionWithClassesAction, setSessionArchivedAction } from '@/actions/classes';
import { idle } from '@buxa/shared';
import { ActionMessage } from './ActionMessage';

export interface SessionWithClasses {
  id: string;
  name: string;
  classCount: number;
}

/** The sentence that opens the prompt for a session that holds classes. */
export function classesPrompt(name: string, classCount: number): string {
  return `${name} has ${classCount} ${classCount === 1 ? 'class' : 'classes'}. Archive the session, or delete its classes and the session.`;
}

/**
 * What a session with classes offers instead of a plain delete: archive it (kept, hidden from registration and its public page), or
 * delete its classes and the session. Deleting asks for the session's name typed exactly before its button enables. The server checks
 * the name too, and refuses a session whose classes have enrolments (then the person is told to archive it).
 */
export function SessionClassesChoice({
  session,
  onArchived,
}: {
  session: SessionWithClasses;
  onArchived: (message: string) => void;
}) {
  const [archiveState, archiveAction, archiving] = useActionState(setSessionArchivedAction, idle);
  const [deleteState, deleteAction, deleting] = useActionState(deleteSessionWithClassesAction, idle);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (archiveState.status === 'success') {
      onArchived(archiveState.message ?? 'Session archived.');
    }
  }, [archiveState, onArchived]);

  const nameMatches = typed === session.name;

  return (
    <div className="class-form">
      <p className="class-helper">{classesPrompt(session.name, session.classCount)}</p>
      {confirming ? (
        <form action={deleteAction} className="class-form">
          <input type="hidden" name="sessionId" value={session.id} />
          <TextField
            label={`Type ${session.name} to confirm`}
            name="confirmName"
            value={typed}
            onChange={setTyped}
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <p className="class-helper">Its classes and the session are removed. This cannot be undone.</p>
          <div className="class-form-actions">
            <Button
              type="button"
              variant="glass"
              disabled={deleting}
              onClick={() => {
                setConfirming(false);
                setTyped('');
              }}
            >
              Back
            </Button>
            <Button type="submit" variant="glass-danger" icon="trash" disabled={!nameMatches || deleting}>
              {deleting ? 'Deleting...' : 'Delete classes and session'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="class-form-actions">
          <form action={archiveAction}>
            <input type="hidden" name="sessionId" value={session.id} />
            <input type="hidden" name="archived" value="1" />
            <Button type="submit" variant="glass" disabled={archiving}>
              {archiving ? 'Archiving...' : 'Archive session'}
            </Button>
          </form>
          <Button
            type="button"
            variant="glass-danger"
            icon="trash"
            disabled={archiving}
            onClick={() => setConfirming(true)}
          >
            Delete classes and session
          </Button>
        </div>
      )}
      <ActionMessage state={archiveState} />
      <ActionMessage state={deleteState} />
    </div>
  );
}

/** The dialog that opens for a session with classes, from the row's trash or the session page's Delete. */
export function SessionClassesDialog({
  session,
  onArchived,
  onClose,
}: {
  session: SessionWithClasses;
  onArchived: (message: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog title="Session has classes" onClose={onClose} className="class-dialog">
      <SessionClassesChoice session={session} onArchived={onArchived} />
    </Dialog>
  );
}
