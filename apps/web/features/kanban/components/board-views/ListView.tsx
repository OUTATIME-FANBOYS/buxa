import { useMemo, useState } from 'react';
import type { Project, Task } from '../types';
import { useStore } from '../store';
import { Icon } from '@/components/ui';
import { Avatar, Empty, PriorityMark, useUi, KIND_TONE, Pill } from '@/components/ui';
import { DueChip } from './Board';
import { PRIORITY_RANK, subtaskProgress } from '../lib/tasks';
import { addDays, diffDays, fmt, parse, toISO, today } from '../lib/dates';

/* ============ List ============ */
type SortKey = 'title' | 'status' | 'priority' | 'assignee' | 'due';
export function ListView({ tasks, projects, readOnly, showProject = false }: { tasks: Task[]; projects: Project[]; readOnly: boolean; showProject?: boolean }) {
  const { actions, userById, kindOf } = useStore(); const { openTask } = useUi();
  const [key, setKey] = useState<SortKey | null>(null); const [dir, setDir] = useState<1 | -1>(1);
  const colName = (t: Task) => projects.find(p => p.id === t.projectId)?.columns.find(c => c.id === t.columnId)?.name ?? '';
  const rows = useMemo(() => {
    if (!key) return tasks;
    const val = (t: Task): string | number => key === 'title' ? t.title.toLowerCase() : key === 'status' ? colName(t) : key === 'priority' ? PRIORITY_RANK[t.priority] : key === 'assignee' ? userById(t.assigneeId)?.name ?? '~' : t.due ?? '9999';
    return [...tasks].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, key, dir]);
  const th = (k: SortKey, label: string, cls = '') => (
    <th className={cls} aria-sort={key === k ? (dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => { if (key === k) setDir(d => (d === 1 ? -1 : 1)); else { setKey(k); setDir(1); } }}>{label}{key === k && <Icon name={dir === 1 ? 'down' : 'down'} size={12} className={dir === 1 ? '' : 'flip'} />}</button>
    </th>
  );
  if (!rows.length) return <Empty icon="search" title="No tasks to show" body="Try clearing a filter or add a new task." />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th className="c-check"><span className="sr-only">Complete</span></th>{th('title', 'Task')}{th('status', 'Status', 'c-status')}{th('priority', 'Priority', 'c-prio')}{th('assignee', 'Assignee', 'c-who')}{th('due', 'Due', 'c-due')}</tr></thead>
        <tbody>
          {rows.map(t => {
            const kind = kindOf(t); const proj = projects.find(p => p.id === t.projectId)!; const sp = subtaskProgress(t);
            const done = proj.columns.find(c => c.kind === 'done'); const first = proj.columns.find(c => c.kind === 'open') ?? proj.columns[0];
            return (
              <tr key={t.id} className={t.archived ? 'is-archived' : ''}>
                <td className="c-check"><input type="checkbox" checked={kind === 'done'} disabled={readOnly || !done} aria-label={`Mark “${t.title}” ${kind === 'done' ? 'not done' : 'done'}`}
                  onChange={() => actions.moveTask(t.id, kind === 'done' ? first.id : done!.id, null)} /></td>
                <td><button className="row-title" onClick={() => openTask(t.id)}>{t.title}</button>
                  <div className="row-sub">{showProject && <span className="muted small">{proj.name}</span>}{t.tags.slice(0, 3).map(g => <span key={g} className="tag">{g}</span>)}{sp.total > 0 && <span className="meta"><Icon name="check" size={12} />{sp.done}/{sp.total}</span>}</div></td>
                <td className="c-status"><Pill tone={KIND_TONE[kind]}>{colName(t)}</Pill></td>
                <td className="c-prio"><PriorityMark priority={t.priority} label /></td>
                <td className="c-who"><span className="who"><Avatar user={userById(t.assigneeId)} size={22} /><span>{userById(t.assigneeId)?.name ?? 'Unassigned'}</span></span></td>
                <td className="c-due"><DueChip due={t.due} kind={kind} />{!t.due && <span className="muted">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ============ Calendar ============ */
export function CalendarView({ tasks, canCreate, projectId }: { tasks: Task[]; canCreate: boolean; projectId?: string }) {
  const { kindOf } = useStore(); const { openTask } = useUi();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const first = new Date(cursor); const startOffset = (first.getDay() + 6) % 7; // Monday start
  const gridStart = new Date(first); gridStart.setDate(1 - startOffset);
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return toISO(d); });
  const byDay = useMemo(() => { const m = new Map<string, Task[]>(); tasks.forEach(t => { if (t.due) m.set(t.due, [...(m.get(t.due) ?? []), t]); }); return m; }, [tasks]);
  const t0 = today(); const month = cursor.getMonth();
  const [more, setMore] = useState<string | null>(null);
  const noDate = tasks.filter(t => !t.due && kindOf(t) !== 'done').length;
  return (
    <div className="calendar">
      <div className="cal-head">
        <h2>{cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <span className="grow" />
        <button className="btn btn-sm" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</button>
        <button className="icon-btn" aria-label="Previous month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><Icon name="left" /></button>
        <button className="icon-btn" aria-label="Next month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><Icon name="right" /></button>
      </div>
      <div className="cal-grid" role="grid" aria-label="Task deadlines">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="cal-dow" role="columnheader">{d}</div>)}
        {days.map(day => {
          const list = byDay.get(day) ?? []; const d = parse(day); const shown = more === day ? list : list.slice(0, 3);
          return (
            <div key={day} role="gridcell" className={`cal-cell ${d.getMonth() !== month ? 'out' : ''} ${day === t0 ? 'today' : ''}`}>
              <div className="cal-num"><span>{d.getDate()}</span>
                {canCreate && projectId && <button className="icon-btn add-day" aria-label={`Add task due ${fmt(day)}`} onClick={() => openTask('new', { due: day, projectId })}><Icon name="plus" size={13} /></button>}</div>
              {shown.map(t => (
                <button key={t.id} className={`cal-task prio-bg-${t.priority} ${kindOf(t) === 'done' ? 'is-done' : ''}`} onClick={() => openTask(t.id)} title={t.title}>
                  <span className="cal-dot" /><span className="cal-title">{t.title}</span></button>
              ))}
              {list.length > 3 && more !== day && <button className="cal-more" onClick={() => setMore(day)}>+{list.length - 3} more</button>}
            </div>
          );
        })}
      </div>
      {noDate > 0 && <p className="muted small">{noDate} open task{noDate === 1 ? ' has' : 's have'} no due date and {noDate === 1 ? 'is' : 'are'} not shown here.</p>}
    </div>
  );
}

/* ============ Timeline ============ */
export function TimelineView({ tasks }: { tasks: Task[] }) {
  const { kindOf, userById } = useStore(); const { openTask } = useUi();
  const [offset, setOffset] = useState(0); const DAYS = 42; const DAYW = 28;
  const t0 = today(); const base = addDays(t0, -((parse(t0).getDay() + 6) % 7) - 7 + offset * 7);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(base, i));
  const rows = useMemo(() => tasks.filter(t => t.due || t.start).map(t => {
    const s = t.start ?? t.due!; const e = t.due ?? t.start!; return { t, s: s <= e ? s : e, e: s <= e ? e : s };
  }).sort((a, b) => a.s.localeCompare(b.s)), [tasks]);
  const unscheduled = tasks.length - rows.length;
  const todayX = diffDays(t0, base) * DAYW + DAYW / 2;
  if (!rows.length) return <Empty icon="timeline" title="Nothing scheduled" body="Give tasks a start or due date and they will appear here." />;
  return (
    <div className="timeline">
      <div className="cal-head">
        <h2>{fmt(base)} – {fmt(addDays(base, DAYS - 1), true)}</h2><span className="grow" />
        <button className="btn btn-sm" onClick={() => setOffset(0)}>Today</button>
        <button className="icon-btn" aria-label="Earlier" onClick={() => setOffset(o => o - 2)}><Icon name="left" /></button>
        <button className="icon-btn" aria-label="Later" onClick={() => setOffset(o => o + 2)}><Icon name="right" /></button>
      </div>
      <div className="tl-scroll">
        <div className="tl" style={{ width: 240 + DAYS * DAYW }}>
          <div className="tl-row tl-header">
            <div className="tl-label" />
            <div className="tl-days">{days.map(d => { const dt = parse(d); return <span key={d} style={{ width: DAYW }} className={`${d === t0 ? 'today' : ''} ${dt.getDay() % 6 === 0 ? 'weekend' : ''}`}>{dt.getDate() === 1 || d === days[0] ? <b>{dt.toLocaleDateString(undefined, { month: 'short' })}</b> : null}{dt.getDate()}</span>; })}</div>
          </div>
          {rows.map(({ t, s, e }) => {
            const left = diffDays(s, base) * DAYW; const width = (diffDays(e, s) + 1) * DAYW; const sp = subtaskProgress(t); const done = kindOf(t) === 'done';
            const visible = left + width > 0 && left < DAYS * DAYW;
            return (
              <div key={t.id} className="tl-row">
                <button className="tl-label" onClick={() => openTask(t.id)} title={t.title}><Avatar user={userById(t.assigneeId)} size={20} /><span>{t.title}</span></button>
                <div className="tl-track" style={{ backgroundSize: `${DAYW * 7}px 100%` }}>
                  {visible && <button className={`tl-bar prio-bg-${t.priority} ${done ? 'is-done' : ''}`} style={{ left: Math.max(left, 0), width: Math.max(width + Math.min(left, 0), DAYW) }} onClick={() => openTask(t.id)}
                    aria-label={`${t.title}, ${fmt(s)} to ${fmt(e)}`}>
                    {sp.total > 0 && <span className="tl-fill" style={{ width: `${(sp.done / sp.total) * 100}%` }} />}
                    <span className="tl-text">{width > 90 ? t.title : ''}</span></button>}
                </div>
              </div>
            );
          })}
          <div className="tl-today" style={{ left: 240 + todayX }} aria-hidden="true" />
        </div>
      </div>
      {unscheduled > 0 && <p className="muted small">{unscheduled} task{unscheduled === 1 ? ' has' : 's have'} no dates and {unscheduled === 1 ? 'is' : 'are'} not shown.</p>}
    </div>
  );
}
