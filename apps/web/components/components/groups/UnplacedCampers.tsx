'use client';

import { useState } from 'react';
import { matchesPersonName } from '@buxa/shared';
import { SearchField } from '@/components/atoms';

export interface UnplacedPerson {
  id: string;
  name: string;
}

/**
 * The campers not placed yet: a search box above a list that scrolls inside its card (a fixed height), so a long camp does not grow the
 * page. The list filters by name as the user types, ignoring case and accents. Clearing the search shows everyone again.
 */
export function UnplacedCampers({ people }: { people: readonly UnplacedPerson[] }) {
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
            <ul className="unplaced-list" aria-label="Campers not placed yet">
              {shown.map(person => (
                <li key={person.id} className="unplaced-list__row">
                  {person.name}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
