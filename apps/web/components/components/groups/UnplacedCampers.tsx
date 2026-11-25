'use client';

import { useState } from 'react';
import { matchesPersonName } from '@buxa/shared';
import { Pagination, SearchField } from '@/components/atoms';
import type { AssignChoices } from './AssignDialog';
import { PlaceButton } from './PlaceButton';

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
  const shown = people.filter(person => matchesPersonName(person.name, query));

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
                        <PlaceButton
                          personId={person.id}
                          choices={choices}
                          accessibleName={`Place ${person.name}`}
                          size="sm"
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
    </section>
  );
}
