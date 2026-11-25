'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/components/ConfirmDialog';
import { deletePeopleAction, type PeopleDeletion } from '@/actions/people';

export interface PersonRef {
  id: string;
  name: string;
}

/**
 * The confirm step before deleting people (owner only). It names the people, says what goes with them, and only deletes on the
 * explicit Delete button. The result goes back to the table, which toasts it.
 */
export function DeletePeopleDialog({
  people,
  onDone,
  onClose,
}: {
  people: readonly PersonRef[];
  onDone: (result: PeopleDeletion) => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const names = people.map(person => person.name).join(', ');
  const count = people.length;

  const run = async () => {
    setPending(true);
    setFailed(false);
    try {
      onDone(await deletePeopleAction(people.map(person => person.id)));
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <ConfirmDialog
      title={count === 1 ? 'Delete person' : `Delete ${count} people`}
      variant="danger"
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      pending={pending}
      onCancel={onClose}
      onConfirm={() => void run()}
      body={
        <>
          <p className="buxa:m-0 buxa:font-bold">{names}</p>
          <p className="muted buxa:m-0">
            This removes their details, memberships, check-ins, badges and household links. It cannot be undone.
          </p>
          {failed && (
            <p role="alert" className="buxa:m-0 buxa:text-[var(--crit)]">
              Could not delete. Try again.
            </p>
          )}
        </>
      }
    />
  );
}
