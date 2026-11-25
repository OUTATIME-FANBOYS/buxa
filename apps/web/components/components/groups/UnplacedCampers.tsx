'use client';

import { useCallback, useState } from 'react';
import { matchesPersonName } from '@buxa/shared';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { Pagination, SearchField } from '@/components/atoms';
import { Button } from '@/components/elements';
import { AssignPopUp, type AssignChoices } from './AssignDialog';

export interface UnplacedPerson {
  id: string;
  name: string;
}

/**
 * The campers not placed yet: a search box above the list, shown ten to a page with Previous and Next under it. The search filters
 * the whole list by name as the user types (ignoring case and accents), then the matches are paged. Typing a new search returns to
 * page 1. Clearing the search shows everyone again.
 * With `choices` (only for people who may place), each row has a Place button that opens the Place or move pop-up with that camper
 * already chosen. The placement runs through the same action and rules as the page button.
 */
export function UnplacedCampers({ people, choices }: { people: readonly UnplacedPerson[]; choices?: AssignChoices }) {
  const [query, setQuery] = useState('');
  const [placingId, setPlacingId] = useState<string | null>(null);
  const shown = people.filter(person => matchesPersonName(person.name, query));
  const close = useCallback(() => setPlacingId(null), []);

  return (
    <section className="panel stack" aria-labelledby="unplaced-heading">
      <h2 id="unplaced-heading" className="people-subheading">
        Campers not placed yet
      </h2>
      {people.length === 0 ? (
        <p className="muted">Every camper is placed.</p>
      ) : (
        <>
          <SearchField
            aria-label="Search campers not placed yet"
            placeholder="Search by name"
            value={query}
            onChange={setQuery}
          />
          {shown.length === 0 ? (
            <p className="muted">No campers match.</p>
          ) : (
            <Pagination items={shown} resetKey={query} label="Pages of campers not placed yet">
              {pageItems => (
                <ul className="unplaced-list" aria-label="Campers not placed yet">
                  {pageItems.map(person => (
                    <li
                      key={person.id}
                      className="unplaced-list__row buxa:flex buxa:items-center buxa:justify-between buxa:gap-[var(--s3)]"
                    >
                      <span>{person.name}</span>
                      {choices && (
                        <Button
                          variant="glass"
                          size="sm"
                          iconOnly
                          icon="plus"
                          type="button"
                          aria-label={`Place ${person.name}`}
                          title={`Place ${person.name}`}
                          onClick={() => setPlacingId(person.id)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Pagination>
          )}
        </>
      )}
      {choices && placingId !== null && <PlacePopUp choices={choices} personId={placingId} onClose={close} />}
    </section>
  );
}

/** The Place or move pop-up with one camper already chosen. Success shows a toast, then the pop-up closes. */
function PlacePopUp({ choices, personId, onClose }: { choices: AssignChoices; personId: string; onClose: () => void }) {
  const { toast } = useUi();
  const done = useCallback(
    (message: string) => {
      toast(message);
      onClose();
    },
    [toast, onClose],
  );

  return <AssignPopUp choices={choices} presetPersonId={personId} onCancel={onClose} onDone={done} />;
}
