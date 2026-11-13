import { useState } from 'react';
import { Icon } from '@/components/ui';

export function TagInput({ tags, onChange, suggestions }: { tags: string[]; onChange: (t: string[]) => void; suggestions: string[] }) {
  const [v, setV] = useState('');
  const add = () => { const t = v.trim().toLowerCase().replace(/,/g, ''); if (t && !tags.includes(t) && t.length <= 24) onChange([...tags, t]); setV(''); };
  return (
    <div className="tag-input">
      {tags.map(t => <span key={t} className="tag tag-x">{t}<button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(tags.filter(x => x !== t))}><Icon name="x" size={11} /></button></span>)}
      <input value={v} list="tag-suggestions" placeholder={tags.length ? '' : 'Add tags'} aria-label="Add a tag" onChange={e => setV(e.target.value)} onBlur={add}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } if (e.key === 'Backspace' && !v && tags.length) onChange(tags.slice(0, -1)); }} />
      <datalist id="tag-suggestions">{suggestions.filter(x => !tags.includes(x)).map(x => <option key={x} value={x} />)}</datalist>
    </div>
  );
}
