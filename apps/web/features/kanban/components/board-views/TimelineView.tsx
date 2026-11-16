import { useMemo, useState } from 'react';
import type { Task } from '../../types';
import { useStore } from '../../state/store';
import { useTaskDrawer } from '../../state/TaskDrawerContext';
import { Avatar, Empty, Icon } from '@/components/ui';
import { subtaskProgress } from '../../lib/tasks';
import { addDays, diffDays, fmt, parse, today } from '../../lib/dates';

const DAYS = 42; const DAYW = 28;

function TimelineHeader({ days, t0 }: { days: string[]; t0: string }) {
  return (
    <div className="tl-row tl-header">
      <div className="tl-label" />
      <div className="tl-days">{days.map(d => { const dt = parse(d); return <span key={d} style={{ width: DAYW }} className={`${d === t0 ? 'today' : ''} ${dt.getDay() % 6 === 0 ? 'weekend' : ''}`}>{dt.getDate() === 1 || d === days[0] ? <b>{dt.toLocaleDateString(undefined, { month: 'short' })}</b> : null}{dt.getDate()}</span>; })}</div>
    </div>
  );
}

function TimelineRow({ task, s, e, base }: { task: Task; s: string; e: string; base: string }) {
  const { kindOf, userById } = useStore(); const { openTask } = useTaskDrawer();
  const left = diffDays(s, base) * DAYW; const width = (diffDays(e, s) + 1) * DAYW; const sp = subtaskProgress(task); const done = kindOf(task) === 'done';
  const visible = left + width > 0 && left < DAYS * DAYW;
  return (
    <div className="tl-row">
      <button className="tl-label" onClick={() => openTask(task.id)} title={task.title}><Avatar user={userById(task.assigneeId)} size={20} /><span>{task.title}</span></button>
      <div className="tl-track" style={{ backgroundSize: `${DAYW * 7}px 100%` }}>
        {visible && <button className={`tl-bar prio-bg-${task.priority} ${done ? 'is-done' : ''}`} style={{ left: Math.max(left, 0), width: Math.max(width + Math.min(left, 0), DAYW) }} onClick={() => openTask(task.id)}
          aria-label={`${task.title}, ${fmt(s)} to ${fmt(e)}`}>
          {sp.total > 0 && <span className="tl-fill" style={{ width: `${(sp.done / sp.total) * 100}%` }} />}
          <span className="tl-text">{width > 90 ? task.title : ''}</span></button>}
      </div>
    </div>
  );
}

export function TimelineView({ tasks }: { tasks: Task[] }) {
  const [offset, setOffset] = useState(0);
  const t0 = today(); const base = addDays(t0, -((parse(t0).getDay() + 6) % 7) - 7 + offset * 7);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(base, i));
  const rows = useMemo(() => tasks.flatMap(t => {
    const first = t.start ?? t.due; const last = t.due ?? t.start; if (!first || !last) return [];
    return [{ t, s: first <= last ? first : last, e: first <= last ? last : first }];
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
          <TimelineHeader days={days} t0={t0} />
          {rows.map(({ t, s, e }) => <TimelineRow key={t.id} task={t} s={s} e={e} base={base} />)}
          <div className="tl-today" style={{ left: 240 + todayX }} aria-hidden="true" />
        </div>
      </div>
      {unscheduled > 0 && <p className="muted small">{unscheduled} task{unscheduled === 1 ? ' has' : 's have'} no dates and {unscheduled === 1 ? 'is' : 'are'} not shown.</p>}
    </div>
  );
}
