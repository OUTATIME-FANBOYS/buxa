'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import type { PersonSummary } from '@buxa/contracts';
import { personPath } from '@/config/routes';
import { Button } from '@/components/elements';
import { Checkbox } from '@/components/atoms';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import type { PeopleDeletion } from '@/actions/people';
import { EditPersonButton } from '@/components/components/people/forms';
import { AccessPill } from './AccessPill';
import { DeletePeopleDialog, type PersonRef } from './DeletePeopleDialog';
import { OnSitePill } from './OnSitePill';
import { RolePills } from './RolePills';

const toRef = (person: PersonSummary): PersonRef => ({
  id: person.id,
  name: `${person.givenName} ${person.familyName}`,
});

/**
 * The membership and on-site columns are for staff; viewers see names and roles only. `canDelete` (the owner) adds a checkbox per
 * row, a select-all, a bulk Delete and a per-row Delete. Everyone who can edit gets an Edit button that opens the Edit person pop-up.
 * After a delete, a toast says how many went; anyone refused stays selected.
 */
export function PeopleTable({
  people,
  staffView,
  canEdit = false,
  canDelete = false,
}: {
  people: readonly PersonSummary[];
  staffView: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [targets, setTargets] = useState<readonly PersonRef[] | null>(null);
  const { toast } = useUi();
  const chosen = people.filter(person => selected.has(person.id));
  const allChosen = people.length > 0 && chosen.length === people.length;

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
  const toggleAll = () => setSelected(allChosen ? new Set() : new Set(people.map(person => person.id)));
  const close = useCallback(() => setTargets(null), []);
  const onDone = useCallback(
    (result: PeopleDeletion) => {
      if (result.deleted.length > 0) {
        toast(result.deleted.length === 1 ? 'Person deleted.' : `${result.deleted.length} people deleted.`);
      }
      if (result.refused.length > 0) {
        toast(`${result.refused.length} could not be deleted.`);
      }
      setSelected(new Set(result.refused));
      setTargets(null);
    },
    [toast],
  );

  return (
    <>
      {canDelete && chosen.length > 0 && (
        <div className="buxa:flex buxa:flex-wrap buxa:items-center buxa:justify-center buxa:gap-2">
          <span className="muted">{chosen.length} selected</span>
          <Button variant="ghost" type="button" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
          <Button variant="glass-danger" type="button" icon="trash" onClick={() => setTargets(chosen.map(toRef))}>
            Delete selected
          </Button>
        </div>
      )}
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">People in the camp</caption>
          <thead>
            <tr>
              {canDelete && (
                <th scope="col">
                  <Checkbox isSelected={allChosen} onChange={toggleAll}>
                    <span className="sr-only">Select all people</span>
                  </Checkbox>
                </th>
              )}
              <th scope="col">Name</th>
              <th scope="col">Roles</th>
              {staffView && <th scope="col">Membership</th>}
              {staffView && <th scope="col">On site</th>}
              {(canEdit || canDelete) && (
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {people.map(person => (
              <tr key={person.id}>
                {canDelete && (
                  <td>
                    <Checkbox isSelected={selected.has(person.id)} onChange={on => toggle(person.id, on)}>
                      <span className="sr-only">Select {person.givenName}</span>
                    </Checkbox>
                  </td>
                )}
                <td>
                  <Link className="row-title" href={personPath(person.id)}>
                    {person.givenName} {person.familyName}
                    {person.preferredName ? ` (${person.preferredName})` : ''}
                  </Link>
                </td>
                <td>
                  <RolePills roles={person.roles} />
                </td>
                {staffView && (
                  <td>
                    <AccessPill status={person.status} />
                  </td>
                )}
                {staffView && (
                  <td>
                    <OnSitePill onSite={person.onSite} />
                  </td>
                )}
                {(canEdit || canDelete) && (
                  <td>
                    <div className="buxa:flex buxa:flex-wrap buxa:justify-center buxa:gap-2">
                      {canEdit && <EditPersonButton personId={person.id} />}
                      {canDelete && (
                        <Button
                          type="button"
                          variant="glass-danger"
                          size="sm"
                          iconOnly
                          icon="trash"
                          aria-label={`Delete ${person.givenName} ${person.familyName}`}
                          title="Delete person"
                          onClick={() => setTargets([toRef(person)])}
                        />
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {targets && <DeletePeopleDialog people={targets} onDone={onDone} onClose={close} />}
    </>
  );
}
