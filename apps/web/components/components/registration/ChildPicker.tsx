'use client';

import { useId, useState } from 'react';
import { SearchField } from '@/components/atoms';
import { Button } from '@/components/elements';
import { ROUTES } from '@/config/routes';

export interface ChildOption {
  id: string;
  name: string;
}

/** The most matches listed under the search at once. */
export const CHILD_RESULT_LIMIT = 6;

/*
 * The Children field of a registration. The chosen children are removable tags, one search box sits under them, and the matches
 * are listed in the flow under the search (never over the other fields). A match closes the list and the search, so the next
 * child is one search away. Add a person opens the add-person page in a new tab, so the registration stays open. The new child
 * shows up in this list the next time the registration opens. Each chosen id is a `chosen` entry, and the form posts them itself.
 */
export function ChildPicker({
  label,
  people,
  chosen,
  onChange,
  error,
}: {
  label: string;
  people: readonly ChildOption[];
  chosen: readonly string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  const generated = useId();
  const errorId = `${generated}-child-error`;
  const [query, setQuery] = useState('');
  const byId = new Map(people.map(p => [p.id, p.name] as const));
  const needle = query.trim().toLowerCase();
  const matches =
    needle === ''
      ? []
      : people
          .filter(p => !chosen.includes(p.id) && p.name.toLowerCase().includes(needle))
          .slice(0, CHILD_RESULT_LIMIT);

  function pick(id: string) {
    onChange([...chosen, id]);
    setQuery('');
  }

  return (
    <div className="child-picker">
      <span className="field-label child-picker__label">
        {label}
        <span className="field-required" aria-hidden="true">
          {' *'}
        </span>
      </span>
      {chosen.length > 0 && (
        <ul className="session-picker__tags" aria-label="Chosen children">
          {chosen.map(id => (
            <li key={id}>
              <button
                type="button"
                className="session-tag"
                onClick={() => onChange(chosen.filter(c => c !== id))}
                aria-label={`Remove ${byId.get(id) ?? 'child'}`}
              >
                {byId.get(id) ?? ''}
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="child-picker__search-row">
        <SearchField
          className="child-picker__search"
          aria-label={`Search ${label.toLowerCase()}`}
          placeholder="Type a name"
          value={query}
          onChange={setQuery}
        />
        <Button variant="glass" icon="plus" href={ROUTES.newPerson} target="_blank" rel="noopener">
          Add a person
        </Button>
      </div>
      {needle !== '' &&
        (matches.length > 0 ? (
          <ul className="child-picker__results" aria-label="Matching children">
            {matches.map(p => (
              <li key={p.id}>
                <button type="button" className="child-picker__result" onClick={() => pick(p.id)}>
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted child-picker__none">No one matches</p>
        ))}
      {error ? (
        <p id={errorId} className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
