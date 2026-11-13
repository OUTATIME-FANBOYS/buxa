import { useMemo, useState } from 'react';
import type { Task } from '../../types';
import { useStore } from '../../state/store';
import { useTaskDrawer } from '../../state/TaskDrawerContext';
import { Icon } from '@/components/ui';
import { fmt, parse, toISO, today } from '../../lib/dates';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

/** The 42 days (six Mondays-first weeks) that cover the month at `cursor`. */
function gridDays(cursor: Date): string[] {
  const startOffset = (cursor.getDay() + 6) % 7;
  const gridStart = new Date(cursor); gridStart.setDate(1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return toISO(d); });
}

export function CalendarView({ tasks, canCreate, projectId }: { tasks: Task[]; canCreate: boolean; projectId?: string }) {
  const { kindOf } = useStore(); const { openTask } = useTaskDrawer();
  const [cursor, setCursor] = useState(() => monthStart(new Date()));
  const days = gridDays(cursor);
  const byDay = useMemo(() => { const m = new Map<string, Task[]>(); tasks.forEach(t => { if (t.due) m.set(t.due, [...(m.get(t.due) ?? []), t]); }); return m; }, [tasks]);
  const t0 = today(); const month = cursor.getMonth();
  const [more, setMore] = useState<string | null>(null);
  const noDate = tasks.filter(t => !t.due && kindOf(t) !== 'done').length;
  return (
    <div className="calendar">
      <div className="cal-head">
        <h2>{cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <span className="grow" />
        <button className="btn btn-sm" onClick={() => setCursor(monthStart(new Date()))}>Today</button>
        <button className="icon-btn" aria-label="Previous month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><Icon name="left" /></button>
        <button className="icon-btn" aria-label="Next month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><Icon name="right" /></button>
      </div>
      <div className="cal-grid" role="grid" aria-label="Task deadlines">
        {WEEKDAYS.map(d => <div key={d} className="cal-dow" role="columnheader">{d}</div>)}
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
