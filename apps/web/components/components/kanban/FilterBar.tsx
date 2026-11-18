'use client';

import { PriorityMark, Button } from '@/components/elements/export';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { Filter, DueFilter, Project, Sort } from '@buxa/shared';
import { useStore } from '@buxa/middleware/providers/providers';
import { Icon } from '@/components/elements/export';
import { Menu } from '@/components/components/export';
import { Popover } from '@/components/components/export';
import { Avatar } from '@/components/elements/export';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { PRIORITIES, emptyFilter, isFilterActive } from '@buxa/shared';
import { requirePresent } from '@buxa/domain';
import { Checkbox, RadioGroup, SearchField, TextField } from '@/components/atoms';

function Chip({
  label,
  count,
  children,
  width = 220,
}: {
  label: string;
  count: number;
  children: ReactNode;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button
        ref={ref}
        variant="ghost"
        size="sm"
        className={`chip ${count ? 'on' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {label}
        {count > 0 && <span className="chip-count">{count}</span>}
        <Icon name="down" size={13} />
      </Button>
      {open && (
        <Popover
          anchor={ref.current}
          onClose={close}
          width={width}
          label={`Filter by ${label.toLowerCase()}`}
          className="checklist-pop"
        >
          {children}
        </Popover>
      )}
    </>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <Checkbox className="check-row" isSelected={checked} onChange={onChange}>
      {children}
    </Checkbox>
  );
}
const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

const DUE: { v: DueFilter; l: string }[] = [
  { v: 'any', l: 'Any time' },
  { v: 'overdue', l: 'Overdue' },
  { v: 'today', l: 'Due today' },
  { v: 'week', l: 'Next 7 days' },
  { v: 'none', l: 'No due date' },
];
const SORT: { v: Sort; l: string }[] = [
  { v: 'manual', l: 'Manual order' },
  { v: 'created', l: 'Newest first' },
  { v: 'priority', l: 'Highest priority' },
  { v: 'due', l: 'Soonest deadline' },
];

export function FilterBar({
  filter,
  setFilter,
  project,
  tags,
  showStatus = true,
}: {
  filter: Filter;
  setFilter: (f: Filter) => void;
  project: Project;
  tags: string[];
  showStatus?: boolean;
}) {
  const { s, actions, members } = useStore();
  const { toast } = useUi();
  const set = (p: Partial<Filter>) => setFilter({ ...filter, ...p });
  const saved = s.savedFilters.filter(f => f.projectId === project.id);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const active = isFilterActive(filter);

  return (
    <div className="filters" role="group" aria-label="Filters and sorting">
      <SearchField
        className="search-local"
        value={filter.q}
        onChange={q => set({ q })}
        placeholder="Filter tasks"
        aria-label="Filter tasks by title or description"
      />
      <Chip label="Priority" count={filter.priorities.length}>
        {PRIORITIES.slice()
          .reverse()
          .map(p => (
            <Check
              key={p}
              checked={filter.priorities.includes(p)}
              onChange={() => set({ priorities: toggle(filter.priorities, p) })}
            >
              <PriorityMark priority={p} label />
            </Check>
          ))}
      </Chip>
      <Chip label="Assignee" count={filter.assignees.length}>
        <Check
          checked={filter.assignees.includes('none')}
          onChange={() => set({ assignees: toggle(filter.assignees, 'none') })}
        >
          <Avatar size={20} /> Unassigned
        </Check>
        {members.map(m => (
          <Check
            key={m.userId}
            checked={filter.assignees.includes(m.userId)}
            onChange={() => set({ assignees: toggle(filter.assignees, m.userId) })}
          >
            <Avatar user={m.user} size={20} /> {m.user.name}
          </Check>
        ))}
      </Chip>
      {showStatus && (
        <Chip label="Status" count={filter.columns.length}>
          {project.columns.map(c => (
            <Check
              key={c.id}
              checked={filter.columns.includes(c.id)}
              onChange={() => set({ columns: toggle(filter.columns, c.id) })}
            >
              {c.name}
            </Check>
          ))}
        </Chip>
      )}
      <Chip label="Due" count={filter.due !== 'any' ? 1 : 0}>
        <RadioGroup
          label="Due"
          name="due"
          value={filter.due}
          onChange={v => set({ due: v as DueFilter })}
          options={DUE.map(d => ({ value: d.v, label: d.l }))}
        />
      </Chip>
      <Chip label="Tags" count={filter.tags.length}>
        {tags.length === 0 && <p className="muted small pad">No tags yet.</p>}
        {tags.map(t => (
          <Check key={t} checked={filter.tags.includes(t)} onChange={() => set({ tags: toggle(filter.tags, t) })}>
            {t}
          </Check>
        ))}
      </Chip>
      <Menu
        label="Sort tasks"
        className="chip buxa-chip-menu"
        align="start"
        trigger={
          <>
            <Icon name="timeline" size={13} />
            {
              requirePresent(
                SORT.find(x => x.v === filter.sort),
                'SORT.find(x => x.v === filter.sort)',
              ).l
            }
            <Icon name="down" size={13} />
          </>
        }
        items={SORT.map(x => ({ label: x.l, checked: filter.sort === x.v, onSelect: () => set({ sort: x.v }) }))}
      />
      <Checkbox className="chip chip-check" isSelected={filter.archived} onChange={archived => set({ archived })}>
        Archived
      </Checkbox>
      <span className="grow" />
      {active && (
        <Button variant="ghost" size="sm" onClick={() => setFilter({ ...emptyFilter, sort: filter.sort })}>
          Clear
        </Button>
      )}
      <Menu
        label="Saved filters"
        className="chip buxa-chip-menu"
        align="end"
        trigger={
          <>
            <Icon name="bookmark" size={13} />
            Saved{saved.length > 0 && <span className="chip-count">{saved.length}</span>}
          </>
        }
        items={[
          ...saved.map(f => ({
            label: f.name,
            icon: 'filter',
            onSelect: () => {
              setFilter(f.filter);
              toast(`Applied “${f.name}”`);
            },
          })),
          saved.length ? { label: '', divider: true, onSelect() {} } : null,
          {
            label: 'Save current filters…',
            icon: 'plus',
            disabled: !active && filter.sort === 'manual',
            onSelect: () => setNaming(true),
          },
          ...saved.map(f => ({
            label: `Delete “${f.name}”`,
            icon: 'trash',
            danger: true,
            onSelect: () => actions.deleteSavedFilter(f.id),
          })),
        ]}
      />
      {naming && (
        <form
          className="save-filter"
          onSubmit={e => {
            e.preventDefault();
            if (!name.trim()) {
              return;
            }
            actions.saveFilter(name.trim(), project.id, filter);
            setNaming(false);
            setName('');
            toast('Filter saved');
          }}
        >
          <TextField
            label="Saved filter name"
            hideLabel
            autoFocus
            value={name}
            onChange={setName}
            placeholder="Name this view"
            maxLength={40}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                setNaming(false);
              }
            }}
          />
          <Button variant="primary" size="sm" icon="save" disabled={!name.trim()}>
            Save
          </Button>
          <Button size="sm" type="button" onClick={() => setNaming(false)}>
            Cancel
          </Button>
        </form>
      )}
    </div>
  );
}
