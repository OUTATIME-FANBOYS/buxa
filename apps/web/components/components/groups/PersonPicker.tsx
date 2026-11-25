'use client';

import { useId } from 'react';

export interface PersonOption {
  id: string;
  name: string;
}

/*
 * The people a placement covers: a labelled select that adds a person as a tag with an x, the same pattern as the registration
 * form's session tags. Each chosen id is posted as a `personId` field, so the form submits every chosen person. The select itself
 * has no name, so it posts nothing.
 */
export function PersonPicker({
  label,
  people,
  chosen,
  onChange,
  error,
}: {
  label: string;
  people: readonly PersonOption[];
  chosen: readonly string[];
  onChange: (personIds: string[]) => void;
  error?: string;
}) {
  const generated = useId();
  const selectId = `${generated}-person`;
  const labelId = `${generated}-person-label`;
  const byId = new Map(people.map(p => [p.id, p.name] as const));
  const available = people.filter(p => !chosen.includes(p.id));
  const emptyText =
    people.length === 0 ? 'No one with this role yet' : available.length === 0 ? 'Everyone is chosen' : 'Add a person';

  return (
    <div className="select-field buxa:grid buxa:gap-[var(--s2)] buxa:min-w-0">
      <label
        id={labelId}
        htmlFor={selectId}
        className="field-label buxa:text-[length:var(--fs-s)] buxa:font-semibold buxa:text-[var(--text-2)]"
      >
        {label}
        <span className="field-required" aria-hidden="true">
          {' *'}
        </span>
      </label>
      <div className="session-picker">
        {chosen.length > 0 && (
          <ul className="session-picker__tags" aria-label="Chosen people">
            {chosen.map(id => (
              <li key={id}>
                <button
                  type="button"
                  className="session-tag"
                  onClick={() => onChange(chosen.filter(c => c !== id))}
                  aria-label={`Remove ${byId.get(id) ?? 'person'}`}
                >
                  {byId.get(id) ?? ''}
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <select
          id={selectId}
          data-field="person"
          aria-labelledby={labelId}
          aria-invalid={Boolean(error) || undefined}
          className="session-picker__input"
          value=""
          disabled={available.length === 0}
          onChange={e => {
            const id = e.target.value;
            if (id !== '' && !chosen.includes(id)) {
              onChange([...chosen, id]);
            }
          }}
        >
          <option value="">{emptyText}</option>
          {available.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
