import type { Filter, Priority, Task, ColumnKind } from '../types';
import { addDays, diffDays, today } from './dates';

export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical'];
export const PRIORITY_LABEL: Record<Priority, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
export const PRIORITY_RANK: Record<Priority, number> = { low: 1, medium: 2, high: 3, critical: 4 };

export const emptyFilter: Filter = { q: '', priorities: [], assignees: [], columns: [], due: 'any', tags: [], sort: 'manual', archived: false };
export const isFilterActive = (f: Filter) =>
  !!(f.q || f.priorities.length || f.assignees.length || f.columns.length || f.due !== 'any' || f.tags.length || f.archived);

export type DueTone = 'overdue' | 'soon' | 'normal' | 'done';
export function dueInfo(due: string | undefined, kind: ColumnKind): { label: string; tone: DueTone } | null {
  if (!due) return null;
  const n = diffDays(due, today());
  const date = new Date(due + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (kind === 'done') return { label: date, tone: 'done' };
  if (n < 0) return { label: n === -1 ? 'Yesterday' : `${-n}d overdue`, tone: 'overdue' };
  if (n === 0) return { label: 'Today', tone: 'soon' };
  if (n === 1) return { label: 'Tomorrow', tone: 'soon' };
  return { label: date, tone: 'normal' };
}

export function matchesFilter(t: Task, f: Filter, kind: ColumnKind): boolean {
  if (t.archived !== f.archived && !(f.archived && !t.archived)) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
  }
  if (f.priorities.length && !f.priorities.includes(t.priority)) return false;
  if (f.assignees.length && !f.assignees.includes(t.assigneeId ?? 'none')) return false;
  if (f.columns.length && !f.columns.includes(t.columnId)) return false;
  if (f.tags.length && !f.tags.some(g => t.tags.includes(g))) return false;
  if (f.due !== 'any') {
    const n = t.due ? diffDays(t.due, today()) : null;
    if (f.due === 'none' && t.due) return false;
    if (f.due === 'overdue' && !(n !== null && n < 0 && kind !== 'done')) return false;
    if (f.due === 'today' && n !== 0) return false;
    if (f.due === 'week' && !(n !== null && n >= 0 && n <= 7)) return false;
  }
  return true;
}

export function sortTasks(tasks: Task[], sort: Filter['sort']): Task[] {
  if (sort === 'manual') return tasks;
  const a = [...tasks];
  if (sort === 'created') a.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  if (sort === 'priority') a.sort((x, y) => PRIORITY_RANK[y.priority] - PRIORITY_RANK[x.priority]);
  if (sort === 'due') a.sort((x, y) => (x.due ?? '9999').localeCompare(y.due ?? '9999'));
  return a;
}

export const subtaskProgress = (t: Task) => ({ done: t.subtasks.filter(s => s.done).length, total: t.subtasks.length });
export const soonDate = () => addDays(today(), 7);
export { initials } from '@/lib/text';
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
export const fmtSize = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
