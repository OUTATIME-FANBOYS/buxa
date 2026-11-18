'use client';

import { useState } from 'react';
import { Button, TextField } from '@/components/elements/export';

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
    <div className="tag-input">
      {tags.map(t => (
        <span key={t} className="tag tag-x">
          {t}
          <Button
            variant="ghost"
            iconOnly
            icon="x"
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
