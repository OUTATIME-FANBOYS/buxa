'use client';

import { useState } from 'react';
import { Dialog } from '@/components/components/Dialog';
import { Button } from '@/components/elements';
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
    <Dialog
      title={count === 1 ? 'Delete person' : `Delete ${count} people`}
      onClose={onClose}
      footer={
        <div className="buxa:flex buxa:w-full buxa:flex-wrap buxa:items-center buxa:justify-center buxa:gap-2">
          <Button variant="glass" type="button" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="glass-danger" type="button" icon="trash" disabled={pending} onClick={() => void run()}>
            {pending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      }
    >
      <div className="buxa:grid buxa:gap-3 buxa:text-center">
        <p className="buxa:m-0">{names}</p>
        <p className="muted buxa:m-0">
          This removes their details, memberships, check-ins, badges and household links. It cannot be undone.
        </p>
        {failed && (
          <p role="alert" className="buxa:m-0 buxa:text-[var(--crit)]">
            Could not delete. Try again.
          </p>
        )}
      </div>
    </Dialog>
  );
}
