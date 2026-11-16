'use client';

import { useEffect, useState } from 'react';
import type { ActionOutcome } from '../actions/outcome';
import { searchPeopleAction } from '../actions/searchPeople';
import type { PersonCard } from '../lib/card';
import { StatusPill } from '../components/StatusPill';
import { displayName } from '../lib/name';

const DEBOUNCE_MS = 200;

/** What the last search answered, and for which query. A result for an older query is simply not shown. */
interface Answer { query: string; outcome: ActionOutcome<PersonCard[]> }

/** Type-ahead name search. Results are people with their status in words; choosing one puts them in the result panel. */
export function NameSearch({ onPick }: { onPick: (card: PersonCard) => void }) {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const trimmed = query.trim();

  useEffect(() => {
    let current = true;
    const timer = window.setTimeout(() => {
      void searchPeopleAction({ query: trimmed }).then(outcome => { if (current) setAnswer({ query: trimmed, outcome }); });
    }, DEBOUNCE_MS);
    return () => { current = false; window.clearTimeout(timer); };
  }, [trimmed]);

  const current = answer?.query === trimmed ? answer.outcome : null;

  return (
    <div className="name-search">
      <label className="field">
        <span className="field-label">Find by name</span>
        <input type="search" value={query} autoComplete="off" spellCheck={false} aria-controls="name-results"
          onChange={event => setQuery(event.target.value)} />
      </label>
      <SearchStatus trimmed={trimmed} current={current} />
      <ul id="name-results" className="name-results">
        {trimmed !== '' && current?.kind === 'ok' && current.value.map(card => (
          <li key={card.person.id}>
            <button type="button" className="name-result" onClick={() => onPick(card)}>
              <span className="name-result-name">{displayName(card.person)}</span>
              <StatusPill status={card.person.status} />
              {card.onSiteSince && <span className="muted small">On site</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SearchStatus({ trimmed, current }: { trimmed: string; current: ActionOutcome<PersonCard[]> | null }) {
  if (trimmed === '') return <p className="muted small" role="status">Type a name to find someone.</p>;
  if (current === null) return <p className="muted small" role="status">Searching.</p>;
  if (current.kind !== 'ok') return <p className="field-error" role="alert">{current.message}</p>;
  if (current.value.length === 0) return <p className="muted small" role="status">No one matches “{trimmed}”.</p>;
  return <p className="muted small" role="status">{current.value.length} found.</p>;
}
