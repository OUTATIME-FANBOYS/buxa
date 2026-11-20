'use client';

import { useMemo, useState } from 'react';
import type { Task } from '@buxa/shared';
import { useStore } from '@buxa/middleware/providers/providers';
import { useTaskDrawer } from '@buxa/middleware/providers/providers';
import { Button } from '@/components/elements';
import { PriorityIcon } from '@/components/atoms/Icon';
import { fmt, parse, toISO, today } from '@buxa/shared';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** How many tasks a day shows before its "+N" control. A day with this many or fewer shows them all, with no control. */
const DAY_PREVIEW = 5;
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

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
  // The days the user has expanded with "+N more". Several can be open at once; each one grows in place.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggleDay = (day: string) =>
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }

      return next;
    });
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
          const isOpen = expanded.has(day);
          const shown = isOpen ? list : list.slice(0, DAY_PREVIEW);
          const hidden = list.length - DAY_PREVIEW;

          const chips = shown.map(t => (
            <Button
              key={t.id}
              variant="ghost"
              size="sm"
              className={`cal-task cal-prio-${t.priority} ${kindOf(t) === 'done' ? 'is-done' : ''}`}
              onClick={() => openTask(t.id)}
              title={t.title}
            >
              <PriorityIcon priority={t.priority} size={14} className="cal-dot" />
              <span className="cal-title">{t.title}</span>
            </Button>
          ));

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
              {isOpen ? <div className="cal-day-list">{chips}</div> : chips}
              {hidden > 0 && (
                <Button
                  variant="glass"
                  size="sm"
                  className="cal-more"
                  aria-expanded={isOpen}
                  aria-label={isOpen ? undefined : `${hidden} more tasks`}
                  onClick={() => toggleDay(day)}
                >
                  {isOpen ? 'Show less' : `+${hidden}`}
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
