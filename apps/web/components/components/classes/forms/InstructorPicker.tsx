'use client';

import { useId, useState } from 'react';

export interface InstructorOption {
  id: string;
  name: string;
}

/**
 * Instructors for a class: a dropdown of the people with the instructor role, and the chosen ones as tags under it. The tags sit in
 * a box of fixed height that scrolls, so the dialog does not grow with each instructor added. Each chosen id is posted as an
 * `instructorIds` field, so the form submits them the way it did with checkboxes.
 */
export function InstructorPicker({
  instructors,
  defaultIds = [],
}: {
  instructors: readonly InstructorOption[];
  defaultIds?: readonly string[];
}) {
  const inputId = useId();
  const [chosen, setChosen] = useState<string[]>(() => defaultIds.filter(id => instructors.some(i => i.id === id)));
  const byId = new Map(instructors.map(i => [i.id, i.name] as const));
  const available = instructors.filter(i => !chosen.includes(i.id));

  const add = (id: string) => {
    if (id !== '' && !chosen.includes(id)) {
      setChosen([...chosen, id]);
    }
  };
  const remove = (id: string) => setChosen(chosen.filter(c => c !== id));

  return (
    <div className="select-field buxa:grid buxa:gap-[var(--s2)] buxa:min-w-0">
      <label
        className="field-label buxa:text-[length:var(--fs-b)] buxa:font-semibold buxa:text-[var(--text-2)]"
        htmlFor={inputId}
      >
        Instructors
      </label>
      {instructors.length === 0 ? (
        <p className="muted">No one has the instructor role yet. Add them under People, then come back.</p>
      ) : (
        <select
          id={inputId}
          className="select-field__input buxa:min-w-0"
          value=""
          onChange={e => add(e.target.value)}
          disabled={available.length === 0}
        >
          <option value="">{available.length === 0 ? 'Every instructor is chosen' : 'Add an instructor'}</option>
          {available.map(i => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      )}
      {chosen.length > 0 && (
        <ul className="instructor-tags" aria-label="Chosen instructors">
          {chosen.map(id => (
            <li key={id}>
              <button
                type="button"
                className="instructor-tag"
                onClick={() => remove(id)}
                aria-label={`Remove ${byId.get(id) ?? 'instructor'}`}
              >
                {byId.get(id) ?? ''}
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {chosen.map(id => (
        <input key={id} type="hidden" name="instructorIds" value={id} />
      ))}
    </div>
  );
}
