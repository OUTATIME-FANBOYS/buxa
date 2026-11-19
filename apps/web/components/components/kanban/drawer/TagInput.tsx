'use client';

import { useState } from 'react';
import { Button, TextField, TAG } from '@/components/elements';

// The chips and the field they sit in. The field inside takes the rest of the row; its own defaults are forced (!).
const BOX =
  'buxa:flex buxa:flex-wrap buxa:gap-[var(--s1)] buxa:items-center buxa:border buxa:border-[var(--line-strong)] buxa:rounded-[var(--r-1)] buxa:[padding:3px_var(--s2)] buxa:min-h-[var(--control-h)]buxa:bg-[var(--surface)] buxa:focus-within:[outline:2px_solid_var(--accent)] buxa:focus-within:[outline-offset:-1px] buxa:focus-within:border-[var(--accent)] buxa:[&_input]:border-0! buxa:[&_input]:flex-1 buxa:[&_input]:min-w-[80px] buxa:[&_input]:h-[28px]! buxa:[&_input]:p-0! buxa:[&_input:focus-visible]:outline-none!';
// A chip's remove button: a small grid, quiet, and text on hover.
const REMOVE = 'buxa:grid! buxa:text-[var(--text-3)]! buxa:hover:text-[var(--text)]!';

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
  const add = () => {
    const t = v.trim().toLowerCase().replace(/,/g, '');
    if (t && !tags.includes(t) && t.length <= 24) {
      onChange([...tags, t]);
    }
    setV('');
  };

  return (
    <div className={`tag-input ${BOX}`}>
      {tags.map(t => (
        <span key={t} className={`tag tag-x ${TAG}`}>
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
      <TextField
        label="Add a tag"
        hideLabel
        value={v}
        placeholder={tags.length ? '' : 'Add tags'}
        onChange={setV}
        inputProps={{ list: 'tag-suggestions', onBlur: add }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          }
          if (e.key === 'Backspace' && !v && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
      />
      <datalist id="tag-suggestions">
        {suggestions
          .filter(x => !tags.includes(x))
          .map(x => (
            <option key={x} value={x} />
          ))}
      </datalist>
    </div>
  );
}
