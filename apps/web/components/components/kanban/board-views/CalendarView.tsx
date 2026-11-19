'use client';

import { useMemo, useState } from 'react';
import type { Task } from '@buxa/shared';
import { useStore } from '@buxa/middleware/providers/providers';
import { useTaskDrawer } from '@buxa/middleware/providers/providers';
import { Button } from '@/components/elements';
import { fmt, parse, toISO, today } from '@buxa/shared';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

/**
 * A task has no type field, so its first tag stands in for one: the tag is hashed to one of the five pastel type
 * tints (cal-type-1..5, tokens.css). A task with no tags gets no tint.
 */
function typeClass(task: Task): string {
  const tag = task.tags[0];
  if (!tag) {
    return '';
  }
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }

  return `cal-type-${(hash % 5) + 1}`;
}

/** The 42 days (six Mondays-first weeks) that cover the month at `cursor`. */
function gridDays(cursor: Date): string[] {
  const startOffset = (cursor.getDay() + 6) % 7;
  const gridStart = new Date(cursor);
  gridStart.setDate(1 - startOffset);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);

    return toISO(d);
  });
}

export function CalendarView({
  tasks,
  canCreate,
  projectId,
}: {
  tasks: Task[];
  canCreate: boolean;
  projectId?: string;
}) {
  const { kindOf } = useStore();
  const { openTask } = useTaskDrawer();
  const [cursor, setCursor] = useState(() => monthStart(new Date()));
  const days = gridDays(cursor);
  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    tasks.forEach(t => {
      if (t.due) {
        m.set(t.due, [...(m.get(t.due) ?? []), t]);
      }
    });

    return m;
  }, [tasks]);
  const t0 = today();
  const month = cursor.getMonth();
  const [more, setMore] = useState<string | null>(null);
  const noDate = tasks.filter(t => !t.due && kindOf(t) !== 'done').length;

  return (
    <div className="calendar">
      <div className="cal-head">
        <h2>{cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <span className="grow" />
        <Button size="sm" onClick={() => setCursor(monthStart(new Date()))}>
          Today
        </Button>
        <Button
          iconOnly
          icon="left"
          aria-label="Previous month"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        />
        <Button
          iconOnly
          icon="right"
          aria-label="Next month"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        />
      </div>
      <div className="cal-grid" role="grid" aria-label="Task deadlines">
        {WEEKDAYS.map(d => (
          <div key={d} className="cal-dow" role="columnheader">
            {d}
          </div>
        ))}
        {days.map(day => {
          const list = byDay.get(day) ?? [];
          const d = parse(day);
          const shown = more === day ? list : list.slice(0, 3);

          return (
            <div
              key={day}
              role="gridcell"
              className={`cal-cell ${d.getMonth() !== month ? 'out' : ''} ${day === t0 ? 'today' : ''}`}
            >
              <div className="cal-num">
                <span>{d.getDate()}</span>
                {canCreate && projectId && (
                  <Button
                    iconOnly
                    icon="plus"
                    className="add-day"
                    aria-label={`Add task due ${fmt(day)}`}
                    onClick={() => openTask('new', { due: day, projectId })}
                  />
                )}
              </div>
              {shown.map(t => (
                <Button
                  key={t.id}
                  variant="ghost"
                  size="sm"
                  className={`cal-task prio-bg-${t.priority} ${typeClass(t)} ${kindOf(t) === 'done' ? 'is-done' : ''}`}
                  onClick={() => openTask(t.id)}
                  title={t.title}
                >
                  <span className="cal-dot" />
                  <span className="cal-title">{t.title}</span>
                </Button>
              ))}
              {list.length > 3 && more !== day && (
                <Button variant="ghost" size="sm" className="cal-more" onClick={() => setMore(day)}>
                  +{list.length - 3} more
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {noDate > 0 && (
        <p className="muted small">
          {noDate} open task{noDate === 1 ? ' has' : 's have'} no due date and {noDate === 1 ? 'is' : 'are'} not shown
          here.
        </p>
      )}
    </div>
  );
}
