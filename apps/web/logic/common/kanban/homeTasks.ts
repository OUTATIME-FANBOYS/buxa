import type { Task } from './types';
import { summarize, type KindOf } from './stats';

/** The four task numbers Home shows. Each comes from the same rules as the boards and reports (see stats.ts). */
export interface TaskCounts { total: number; inProgress: number; completed: number; overdue: number }

export function taskCounts(tasks: Task[], kindOf: KindOf): TaskCounts {
  const { live, active, done, overdue } = summarize(tasks, kindOf);
  return { total: live.length, inProgress: active.length, completed: done.length, overdue: overdue.length };
}

/** One sentence for the staff tasks panel. */
export function taskSummary(counts: TaskCounts): string {
  if (counts.total === 0) return 'No tasks yet. Create a project and add your first task.';
  return `${counts.inProgress} in progress, ${counts.completed} of ${counts.total} done, ${counts.overdue} overdue.`;
}
