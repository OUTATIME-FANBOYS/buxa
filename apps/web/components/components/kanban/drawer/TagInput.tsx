'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { Button, TAG } from '@/components/elements';

// The chips and the input they sit in: one wrapping line with no fixed height. The input's own defaults are forced (!).
const BOX =
  'buxa:flex buxa:flex-wrap buxa:gap-[var(--s1)] buxa:items-center buxa:border buxa:border-[var(--line-strong)] buxa:rounded-[var(--r-1)] buxa:[padding:3px_var(--s2)] buxa:min-h-[var(--control-h)] buxa:bg-[var(--surface)] buxa:focus-within:[outline:2px_solid_var(--accent)] buxa:focus-within:[outline-offset:-1px] buxa:focus-within:border-[var(--accent)] buxa:[&_input]:border-0! buxa:[&_input]:flex-1 buxa:[&_input]:min-w-[80px] buxa:[&_input]:h-[28px]! buxa:[&_input]:p-0! buxa:[&_input]:bg-transparent! buxa:[&_input:focus-visible]:outline-none!';
// A chip is a thin rounded rectangle, not a pill: it sits at the height of the text beside it.
const CHIP = 'buxa:rounded-[var(--r-1)]! buxa:[padding:0_2px_0_6px]! buxa:leading-[16px]!';
// A chip's remove button: a small grid, quiet, and text on hover.
const REMOVE = 'buxa:grid! buxa:w-[14px]! buxa:h-[14px]! buxa:text-[var(--text-3)]! buxa:hover:text-[var(--text)]!';
// The matching tags, listed under the field while something is typed.
const LIST =
  'buxa:grid buxa:gap-[2px] buxa:m-0 buxa:p-[var(--s1)] buxa:rounded-[var(--r-1)] buxa:border buxa:border-[var(--line)] buxa:bg-[var(--surface)] buxa:shadow-[var(--shadow-1)]';
const OPTION =
  'buxa:px-[var(--s2)] buxa:py-[var(--s1)] buxa:rounded-[var(--r-1)] buxa:cursor-pointer buxa:text-[length:var(--fs-s)] buxa:text-[var(--text)] buxa:aria-selected:bg-[var(--hover)]';

const MAX_TAG = 24;
const MAX_SUGGESTIONS = 6;

/** A tag as typed or chosen: trimmed, lower case, without commas. */
export function cleanTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/,/g, '');
}

/** The workspace's tags that match what is typed and are not on this task yet; tags that start with it come first. */
export function suggestTags(all: string[], chosen: string[], typed: string): string[] {
  const needle = cleanTag(typed);
  if (!needle) {
    return [];
  }
  const free = Array.from(new Set(all)).filter(t => !chosen.includes(t) && t.includes(needle));
  const starts = free.filter(t => t.startsWith(needle));

  return [...starts, ...free.filter(t => !starts.includes(t))].slice(0, MAX_SUGGESTIONS);
}

/**
 * A task's tags as chips, and a field to add more. As you type, the workspace's existing tags that match are listed under the
 * field. Enter, or a click, adds the highlighted suggestion or else the typed text; a tag nobody has used yet is created by
 * adding it, and it is offered as a suggestion everywhere once a task carries it.
 */
export function TagInput({
  tags,
  onChange,
  suggestions,
}: {
  tags: string[];
  onChange: (t: string[]) => void;
  suggestions: string[];
}) {
  const [v, setV] = useState('');
  const [active, setActive] = useState(-1);
  const listId = useId();
  const shown = suggestTags(suggestions, tags, v);
  const open = shown.length > 0;

  const add = (raw: string) => {
    const t = cleanTag(raw);
    if (t && !tags.includes(t) && t.length <= MAX_TAG) {
      onChange([...tags, t]);
    }
    setV('');
    setActive(-1);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && open) {
      e.preventDefault();
      setActive(i => (i + 1) % shown.length);
    } else if (e.key === 'ArrowUp' && open) {
      e.preventDefault();
      setActive(i => (i <= 0 ? shown.length - 1 : i - 1));
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(active >= 0 && shown[active] ? shown[active] : v);
    } else if (e.key === 'Backspace' && !v && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="buxa:grid buxa:gap-[var(--s1)] buxa:min-w-0">
      <div className={`tag-input ${BOX}`}>
        {tags.map(t => (
          <span key={t} className={`tag tag-x ${TAG} ${CHIP}`}>
            {t}
            <Button
              variant="ghost"
              iconOnly
              icon="x"
              className={REMOVE}
              aria-label={`Remove tag ${t}`}
              onClick={() => onChange(tags.filter(x => x !== t))}
            />
          </span>
        ))}
        <input
          type="text"
          role="combobox"
          aria-label="Add a tag"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={v}
          placeholder={tags.length ? '' : 'Add tags'}
          onChange={e => {
            setV(e.target.value);
            setActive(-1);
          }}
          onKeyDown={onKey}
          onBlur={() => {
            if (v) {
              add(v);
            }
          }}
        />
      </div>
      {open && (
        <ul id={listId} role="listbox" aria-label="Matching tags" className={LIST}>
          {shown.map((t, i) => (
            <li
              key={t}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={OPTION}
              onMouseDown={e => e.preventDefault()}
              onClick={() => add(t)}
            >
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
