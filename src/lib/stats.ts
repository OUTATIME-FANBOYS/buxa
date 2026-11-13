/** Read-side rules: what "done", "overdue" and "progress" mean. One definition, used by every screen. */
import type { ColumnKind, Task } from '../types';
import { today } from './dates';

export type KindOf = (t: Task) => ColumnKind;

export const isLive = (t: Task) => !t.archived;
export const isDone = (t: Task, kindOf: KindOf) => kindOf(t) === 'done';
export const isOverdue = (t: Task, kindOf: KindOf, on = today()) => !!t.due && t.due < on && kindOf(t) !== 'done';

export interface Progress { total: number; done: number; pct: number }
export function progressOf(tasks: Task[], kindOf: KindOf): Progress {
  const live = tasks.filter(isLive); const done = live.filter(t => isDone(t, kindOf)).length;
  return { total: live.length, done, pct: live.length ? (done / live.length) * 100 : 0 };
}

export function summarize(tasks: Task[], kindOf: KindOf) {
  const live = tasks.filter(isLive);
  const done = live.filter(t => isDone(t, kindOf)); const active = live.filter(t => kindOf(t) === 'active');
  const open = live.filter(t => !isDone(t, kindOf)); const overdue = open.filter(t => isOverdue(t, kindOf));
  return { live, done, active, open, overdue, progress: progressOf(tasks, kindOf) };
}

/** How a project is doing against its deadline. One rule, so the pill, the bar colour and the reports agree. */
export type Health = 'done' | 'late' | 'risk' | 'track';
export const HEALTH_LABEL: Record<Health, string> = { done: 'Complete', late: 'Late', risk: 'At risk', track: 'On track' };
export const HEALTH_TONE: Record<Health, 'ok' | 'crit' | 'warn' | 'brand'> = { done: 'ok', late: 'crit', risk: 'warn', track: 'brand' };
export function healthOf(p: Progress, deadline?: string, on = today()): Health {
  if (p.total > 0 && p.done === p.total) return 'done';
  if (!deadline) return 'track';
  if (deadline < on) return 'late';
  const daysLeft = Math.round((Date.parse(deadline) - Date.parse(on)) / 86400000);
  return daysLeft <= 7 && p.pct < 80 ? 'risk' : 'track';
}
