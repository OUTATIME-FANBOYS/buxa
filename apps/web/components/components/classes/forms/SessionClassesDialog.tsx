'use client';

import { useActionState, useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/components/ConfirmDialog';
import { Button } from '@/components/elements';
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
const ARCHIVE_FORM = 'archive-session-form';
const DELETE_FORM = 'delete-session-classes-form';

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
 * The dialog that opens for a session with classes, from the row's trash or the session page's Delete. It has two steps on one
 * prompt. The first offers Archive (kept, hidden from registration and its public page) beside Delete classes and session. The
 * second asks for the session's name typed exactly before its delete button enables. The server checks the name too, and refuses
 * a session whose classes have enrolments (then the person is told to archive it). A draft lists what will go before the name.
 */
export function SessionClassesDialog({
  session,
  onArchived,
  onClose,
}: {
  session: SessionWithClasses;
  onArchived: (message: string) => void;
  onClose: () => void;
}) {
  const [archiveState, archiveAction, archiving] = useActionState(setSessionArchivedAction, idle);
  const [deleteState, deleteAction, deleting] = useActionState(deleteSessionWithClassesAction, idle);
  const [confirming, setConfirming] = useState(false);
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

  const messages = (
    <>
      <ActionMessage state={archiveState} />
      <ActionMessage state={deleteState} />
    </>
  );

  if (!confirming) {
    return (
      <ConfirmDialog
        title="Session has classes"
        variant="danger"
        className="class-dialog"
        confirmLabel="Delete classes and session"
        confirmDisabled={archiving}
        onCancel={onClose}
        onConfirm={() => setConfirming(true)}
        secondaryAction={
          <Button type="submit" form={ARCHIVE_FORM} variant="primary" disabled={archiving}>
            {archiving ? 'Archiving...' : 'Archive session'}
          </Button>
        }
        body={
          <>
            <p className="class-helper">{classesPrompt(session.name, session.classCount, session.status)}</p>
            <form id={ARCHIVE_FORM} action={archiveAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="archived" value="1" />
            </form>
            {messages}
          </>
        }
      />
    );
  }

  return (
    <ConfirmDialog
      title="Session has classes"
      variant="danger"
      className="class-dialog"
      confirmLabel={draft ? 'Delete draft and everything under it' : 'Delete classes and session'}
      pendingLabel="Deleting..."
      pending={deleting}
      confirmDisabled={draft && impact === null}
      confirmText={session.name}
      cancelLabel="Back"
      onCancel={() => setConfirming(false)}
      formId={DELETE_FORM}
      formAction={deleteAction}
      body={
        <>
          <input type="hidden" name="sessionId" value={session.id} />
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
          {messages}
        </>
      }
    />
  );
}
