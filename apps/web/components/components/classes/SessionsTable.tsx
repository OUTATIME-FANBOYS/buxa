'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import type { Session } from '@buxa/contracts';
import { sessionPath } from '@/config/routes';
import { Checkbox } from '@/components/atoms';
import { Button } from '@/components/elements';
import { Toast } from '@/components/components';
import { deletedMessage, notDeletedMessage, type SessionDeletionDone } from '@buxa/shared';
import { DeleteSessionsDialog, EditSessionButton, type SessionRef } from './forms';
import { SessionSelectionBar } from './SessionSelectionBar';

const toRef = (session: Session): SessionRef => ({ id: session.id, name: session.name });

/**
 * The camp's sessions: name, the date range it covers, and how many classes it holds. Staff (canManage) also get a checkbox per row
 * with a select-all, a bar with the count, Clear and Delete selected, and per row an Edit (the Edit session dialog) and a Delete.
 * After a delete, a toast says how many went; any refused session is named in a line above the table, and stays selected.
 */
export function SessionsTable({ sessions, canManage }: { sessions: readonly Session[]; canManage: boolean }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [targets, setTargets] = useState<readonly SessionRef[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);

  const chosen = sessions.filter(session => selected.has(session.id));
  const allChosen = sessions.length > 0 && chosen.length === sessions.length;

  const toggle = (id: string, on: boolean) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (on) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  const toggleAll = () => setSelected(allChosen ? new Set() : new Set(sessions.map(session => session.id)));
  const clear = () => setSelected(new Set());
  const close = useCallback(() => setTargets(null), []);
  const onDone = useCallback((result: SessionDeletionDone) => {
    if (result.deleted.length > 0) {
      setToast({ key: Date.now(), text: deletedMessage(result.deleted.length) });
    }
    setNotice(notDeletedMessage(result.refused));
    setSelected(new Set(result.refused.map(refused => refused.id)));
  }, []);

  return (
    <>
      {canManage && chosen.length > 0 && (
        <SessionSelectionBar count={chosen.length} onClear={clear} onDelete={() => setTargets(chosen.map(toRef))} />
      )}
      {notice && (
        <p role="status" className="people-message">
          {notice}
        </p>
      )}
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">Sessions in the camp</caption>
          <thead>
            <tr>
              {canManage && (
                <th scope="col">
                  <Checkbox isSelected={allChosen} onChange={toggleAll}>
                    <span className="sr-only">Select all sessions</span>
                  </Checkbox>
                </th>
              )}
              <th scope="col">Session</th>
              <th scope="col">Dates</th>
              <th scope="col">Classes</th>
              {canManage && (
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sessions.map(session => (
              <tr key={session.id}>
                {canManage && (
                  <td>
                    <Checkbox isSelected={selected.has(session.id)} onChange={on => toggle(session.id, on)}>
                      <span className="sr-only">Select {session.name}</span>
                    </Checkbox>
                  </td>
                )}
                <td>
                  <Link className="row-title classes-target" href={sessionPath(session.id)}>
                    {session.name}
                  </Link>
                </td>
                <td>
                  {session.startsOn && session.endsOn
                    ? `${session.startsOn} to ${session.endsOn}`
                    : 'Dates not set yet'}
                </td>
                <td>{session.classCount}</td>
                {canManage && (
                  <td>
                    <div className="classes-row-actions">
                      <EditSessionButton session={session} />
                      <Button
                        type="button"
                        variant="glass-danger"
                        size="sm"
                        iconOnly
                        icon="trash"
                        aria-label={`Delete ${session.name}`}
                        title="Delete session"
                        aria-haspopup="dialog"
                        onClick={() => setTargets([toRef(session)])}
                      />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {targets && <DeleteSessionsDialog sessions={targets} onDone={onDone} onClose={close} />}
      {toast && <Toast key={toast.key} message={toast.text} />}
    </>
  );
}
