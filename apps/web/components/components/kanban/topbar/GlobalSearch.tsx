'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@buxa/middleware/providers/providers';
import { useTaskDrawer } from '@buxa/middleware/providers/providers';
import { SearchField } from '@/components/atoms';

export function GlobalSearch({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const { wsTasks, userById, s } = useStore();
  const { openTask } = useTaskDrawer();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) {
      return [];
    }

    return wsTasks
      .filter(
        x =>
          x.title.toLowerCase().includes(t) ||
          x.description.toLowerCase().includes(t) ||
          x.tags.some(g => g.includes(t)),
      )
      .slice(0, 8);
  }, [q, wsTasks]);
  const pick = (id: string) => {
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
    openTask(id);
  };

  return (
    <div className="search" role="search">
      <SearchField
        aria-label="Search all tasks"
        placeholder="Search tasks"
        value={q}
        onChange={value => {
          setQ(value);
          setOpen(true);
          setI(0);
        }}
        inputRef={inputRef}
        inputProps={{
          role: 'combobox',
          'aria-expanded': open && !!q,
          'aria-controls': 'search-results',
          onFocus: () => setOpen(true),
          onBlur: () => setTimeout(() => setOpen(false), 120),
          onKeyDown: e => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setI(x => Math.min(results.length - 1, x + 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setI(x => Math.max(0, x - 1));
            }
            if (e.key === 'Enter' && results[i]) {
              pick(results[i].id);
            }
            if (e.key === 'Escape') {
              setQ('');
              inputRef.current?.blur();
            }
          },
        }}
      />
      <kbd className="kbd">⌘K</kbd>
      {open && q.trim() && (
        <ul id="search-results" className="search-results" role="listbox">
          {results.length === 0 && <li className="search-none">No tasks match “{q}”.</li>}
          {results.map((t, n) => (
            <li
              key={t.id}
              role="option"
              aria-selected={n === i}
              className={n === i ? 'on' : ''}
              onMouseDown={e => {
                e.preventDefault();
                pick(t.id);
              }}
              onMouseEnter={() => setI(n)}
            >
              <span className="sr-title">{t.title}</span>
              <span className="muted small">
                {s.projects.find(p => p.id === t.projectId)?.name}
                {t.assigneeId ? ' · ' + userById(t.assigneeId)?.name : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
