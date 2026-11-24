'use client';

import { useActionState, useEffect, useState } from 'react';
import { Dialog } from '@/components/components/Dialog';
import { Button } from '@/components/elements';
import { TextField } from '@/components/atoms';
import type { SessionDeleteImpact, SessionStatus } from '@buxa/contracts';
import { deleteSessionWithClassesAction, sessionDeleteImpactAction, setSessionArchivedAction } from '@/actions/classes';
import { idle } from '@buxa/shared';
import { ActionMessage } from './ActionMessage';

export interface SessionWithClasses {
  id: string;
  name: string;
  classCount: number;
  /** A draft is deleted with everything under it; a live or archived session is refused while anyone is enrolled. */
  status?: SessionStatus;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The list of what deleting a draft removes, for the confirmation. Zero counts are left out. */
export function impactLines(impact: SessionDeleteImpact): string[] {
  const lines = [
    impact.classes > 0 ? plural(impact.classes, 'class', 'classes') : null,
    impact.groups > 0 ? plural(impact.groups, 'group', 'groups') : null,
    impact.rooms > 0 ? plural(impact.rooms, 'room', 'rooms') : null,
    impact.assignments > 0 ? plural(impact.assignments, 'assignment', 'assignments') : null,
    impact.instructors > 0 ? plural(impact.instructors, 'instructor link', 'instructor links') : null,
    impact.formLinks > 0 ? plural(impact.formLinks, 'registration form link', 'registration form links') : null,
  ];

  return lines.filter((line): line is string => line !== null);
}

/** The sentence that opens the prompt for a session that holds classes. */
export function classesPrompt(name: string, classCount: number, status?: SessionStatus): string {
  if (status === 'draft') {
    return `${name} is a draft with ${classCount} ${classCount === 1 ? 'class' : 'classes'}. Nobody can have registered yet, so you can delete it with everything under it, or archive it.`;
  }

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
  const [impact, setImpact] = useState<SessionDeleteImpact | null>(null);
  const [impactError, setImpactError] = useState<string | null>(null);
  const draft = session.status === 'draft';

  // A draft is deleted with everything under it, so the confirmation lists what will go before the name is typed.
  useEffect(() => {
    if (!confirming || !draft) {
      return;
    }
    let cancelled = false;
    void sessionDeleteImpactAction(session.id).then(result => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setImpact(result.impact);
      } else {
        setImpactError(result.message);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [confirming, draft, session.id]);

  useEffect(() => {
    if (archiveState.status === 'success') {
      onArchived(archiveState.message ?? 'Session archived.');
    }
  }, [archiveState, onArchived]);

  const nameMatches = typed === session.name;

  return (
    <div className="class-form">
      <p className="class-helper">{classesPrompt(session.name, session.classCount, session.status)}</p>
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
          {draft ? (
            <div className="class-helper" data-testid="delete-impact">
              {impact ? (
                <>
                  <p>Deleting this draft removes:</p>
                  <ul>
                    {impactLines(impact).map(line => (
                      <li key={line}>{line}</li>
                    ))}
                    <li>the session itself</li>
                  </ul>
                </>
              ) : impactError ? (
                <p role="alert">{impactError}</p>
              ) : (
                <p>Checking what this session holds...</p>
              )}
              <p>This cannot be undone.</p>
            </div>
          ) : (
            <p className="class-helper">
              Its classes and the session are removed. This cannot be undone. A live session whose classes have students
              enrolled, holds or registrations is refused: unenrol everyone first (refunds may be needed).
            </p>
          )}
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
            <Button
              type="submit"
              variant="glass-danger"
              icon="trash"
              disabled={!nameMatches || deleting || (draft && impact === null)}
            >
              {deleting ? 'Deleting...' : draft ? 'Delete draft and everything under it' : 'Delete classes and session'}
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
