'use client';

import { useState } from 'react';

export interface SessionOption {
  id: string;
  name: string;
}

/*
 * The sessions a registration form covers: a text-field-like box. Choosing a session in the box's select adds it as a tag with an x;
 * the x removes it. Each chosen id is posted as a `sessionIds` field, so the form submits the same field it did with checkboxes.
 */
export function SessionPicker({
  sessions,
  defaultIds = [],
  labelledBy,
}: {
  sessions: readonly SessionOption[];
  defaultIds?: readonly string[];
  /** The id of the heading that names the field, so the select is announced with it. */
  labelledBy: string;
}) {
  const [chosen, setChosen] = useState<string[]>(() => defaultIds.filter(id => sessions.some(s => s.id === id)));
  const byId = new Map(sessions.map(s => [s.id, s.name] as const));
  const available = sessions.filter(s => !chosen.includes(s.id));

  const add = (id: string) => {
    if (id !== '' && !chosen.includes(id)) {
      setChosen([...chosen, id]);
    }
  };
  const remove = (id: string) => setChosen(chosen.filter(c => c !== id));

  return (
    <div className="session-picker">
      {chosen.length > 0 && (
        <ul className="session-picker__tags" aria-label="Chosen sessions">
          {chosen.map(id => (
            <li key={id}>
              <button
                type="button"
                className="session-tag"
                onClick={() => remove(id)}
                aria-label={`Remove ${byId.get(id) ?? 'session'}`}
              >
                {byId.get(id) ?? ''}
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <select
        aria-labelledby={labelledBy}
        className="session-picker__input"
        value=""
        onChange={e => add(e.target.value)}
        disabled={available.length === 0}
      >
        <option value="">{available.length === 0 ? 'Every session is chosen' : 'Add a session'}</option>
        {available.map(s => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {chosen.map(id => (
        <input key={id} type="hidden" name="sessionIds" value={id} />
      ))}
    </div>
  );
}
