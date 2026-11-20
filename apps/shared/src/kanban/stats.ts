/** Read-side rules: what "done", "overdue" and "progress" mean. One definition, used by every screen. */
import type { ColumnKind, Priority, Task } from './types';
import { addDays, diffDays, fmt, isoDay, today } from '../dates';
import { PRIORITIES } from './tasks';

export type KindOf = (t: Task) => ColumnKind;

export const isLive = (t: Task) => !t.archived;
export const isDone = (t: Task, kindOf: KindOf) => kindOf(t) === 'done';
export const isOverdue = (t: Task, kindOf: KindOf, on = today()) => !!t.due && t.due < on && kindOf(t) !== 'done';

export interface Progress {
  total: number;
  done: number;
  pct: number;
}
export function progressOf(tasks: Task[], kindOf: KindOf): Progress {
  const live = tasks.filter(isLive);
  const done = live.filter(t => isDone(t, kindOf)).length;

  return { total: live.length, done, pct: live.length ? (done / live.length) * 100 : 0 };
}

export function summarize(tasks: Task[], kindOf: KindOf) {
  const live = tasks.filter(isLive);
  const done = live.filter(t => isDone(t, kindOf));
  const active = live.filter(t => kindOf(t) === 'active');
  const open = live.filter(t => !isDone(t, kindOf));
  const overdue = open.filter(t => isOverdue(t, kindOf));

  return { live, done, active, open, overdue, progress: progressOf(tasks, kindOf) };
}

/** How a project is doing against its deadline. One rule, so the pill, the bar colour and the reports agree. */
export type Health = 'done' | 'late' | 'risk' | 'track';
export const HEALTH_LABEL: Record<Health, string> = {
  done: 'Complete',
  late: 'Late',
  risk: 'At risk',
  track: 'On track',
};
export const HEALTH_TONE: Record<Health, 'ok' | 'crit' | 'warn' | 'brand'> = {
  done: 'ok',
  late: 'crit',
  risk: 'warn',
  track: 'brand',
};
export function healthOf(p: Progress, deadline?: string, on = today()): Health {
  if (p.total > 0 && p.done === p.total) {
    return 'done';
  }
  if (!deadline) {
    return 'track';
  }
  if (deadline < on) {
    return 'late';
  }
  const daysLeft = Math.round((Date.parse(deadline) - Date.parse(on)) / 86400000);

  return daysLeft <= 7 && p.pct < 80 ? 'risk' : 'track';
}

/** One bar of the completion chart: a day, or a week ending on the day `title` names. */
export interface CompletionPoint {
  label: string;
  title: string;
  value: number;
}

/** The 90-day range is shown as this many weekly buckets (the last one ends on `on`). */
export const WEEKS_IN_SERIES = 13;

function dailySeries(done: Task[], days: number, on: string): CompletionPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(on, i - days + 1);

    return {
      label: fmt(d),
      title: fmt(d, true),
      value: done.filter(t => t.completedAt && isoDay(t.completedAt) === d).length,
    };
  });
}

function weeklySeries(done: Task[], on: string): CompletionPoint[] {
  return Array.from({ length: WEEKS_IN_SERIES }, (_, i) => {
    const end = addDays(on, -(WEEKS_IN_SERIES - 1 - i) * 7);
    const start = addDays(end, -6);

    return {
      label: fmt(start),
      title: `${fmt(start)} – ${fmt(end)}`,
      value: done.filter(t => {
        if (!t.completedAt) {
          return false;
        }
        const c = isoDay(t.completedAt);

        return c >= start && c <= end;
      }).length,
    };
  });
}

/** Completions per day for ranges up to 30 days, per week (oldest first) for longer ranges. */
export function completionSeries(done: Task[], days: number, on = today()): CompletionPoint[] {
  return days <= 30 ? dailySeries(done, days, on) : weeklySeries(done, on);
}

/** Average whole days from creation to completion, over done tasks that have a completion date. Null when none do. */
export function avgCycleDays(done: Task[]): number | null {
  const durations = done.flatMap(t =>
    t.completedAt ? [Math.max(0, diffDays(isoDay(t.completedAt), isoDay(t.createdAt)))] : [],
  );
  if (durations.length === 0) {
    return null;
  }

  return durations.reduce((a, b) => a + b, 0) / durations.length;
}

export interface MemberLoad<M extends { userId: string }> {
  member: M;
  /** open tasks not yet overdue */
  on: number;
  /** open tasks past their due date */
  late: number;
}

/** Open tasks per member, split on track and overdue. Busiest first. */
export function memberLoad<M extends { userId: string }>(
  open: Task[],
  members: M[],
  kindOf: KindOf,
  on = today(),
): MemberLoad<M>[] {
  return members
    .map(member => ({
      member,
      on: open.filter(t => t.assigneeId === member.userId && !isOverdue(t, kindOf, on)).length,
      late: open.filter(t => t.assigneeId === member.userId && isOverdue(t, kindOf, on)).length,
    }))
    .sort((a, b) => b.on + b.late - (a.on + a.late));
}

/** Members with at least one overdue task. */
export function overdueByMember<M extends { userId: string }>(load: MemberLoad<M>[]): MemberLoad<M>[] {
  return load.filter(l => l.late > 0);
}

/** Open tasks per priority, lowest first (the order of PRIORITIES). */
export function priorityCounts(open: Task[]): { priority: Priority; count: number }[] {
  return PRIORITIES.map(priority => ({ priority, count: open.filter(t => t.priority === priority).length }));
}

/** Open tasks with no assignee. */
export function unassignedCount(open: Task[]): number {
  return open.filter(t => !t.assigneeId).length;
}
