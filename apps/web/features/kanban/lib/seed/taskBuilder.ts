import type { Priority, Project, Task } from '../../types';
import { addDays, iso, today } from '../dates';
import { uid } from '../tasks';
import { USER, type ProjectId } from './ids';

/** Index into a project's default columns: 0 Backlog, 1 To Do, 2 In Progress, 3 In Review, 4 Done. */
export type ColumnSlot = 0 | 1 | 2 | 3 | 4;
type Extras = {
  desc?: string;
  subs?: [title: string, done: boolean][];
  comments?: [authorId: string, body: string][];
  files?: string[];
  /** Days from today the task was created / completed (negative = in the past). */
  created?: number;
  done?: number;
};
export type TaskSpec = {
  project: ProjectId; slot: ColumnSlot; title: string; priority: Priority; who: string | undefined;
  start: number | null; due: number | null; tags: string[]; extras: Extras;
};

/** Dates are days from today; null means "not set". */
export const spec = (
  project: ProjectId, slot: ColumnSlot, title: string, priority: Priority, who: string | undefined,
  start: number | null, due: number | null, tags: string[], extras: Extras = {},
): TaskSpec => ({ project, slot, title, priority, who, start, due, tags, extras });

/** A finished task: `finishedDaysAgo` is negative, and the start/due dates are derived around it. */
export const doneSpec = (
  project: ProjectId, title: string, priority: Priority, who: string, finishedDaysAgo: number, tags: string[], createdOffset = 5,
): TaskSpec => spec(project, 4, title, priority, who, finishedDaysAgo - 6, finishedDaysAgo + 1, tags, { created: finishedDaysAgo - createdOffset, done: finishedDaysAgo });

export function buildTasks(specs: TaskSpec[], projects: Project[]): Task[] {
  const columnId = (projectId: string, slot: ColumnSlot) => {
    const project = projects.find(p => p.id === projectId);
    const column = project?.columns[slot];
    if (!column) throw new Error(`Seed refers to a missing column ${slot} of project ${projectId}`);
    return column.id;
  };
  return specs.map((s, i) => {
    const created = s.extras.created ?? -(8 + (i % 12));
    return {
      id: 't-' + (i + 1), projectId: s.project, columnId: columnId(s.project, s.slot), title: s.title,
      description: s.extras.desc ?? '', priority: s.priority, assigneeId: s.who,
      start: s.start === null ? undefined : addDays(today(), s.start), due: s.due === null ? undefined : addDays(today(), s.due),
      tags: s.tags, subtasks: (s.extras.subs ?? []).map(([title, done]) => ({ id: uid(), title, done })),
      comments: (s.extras.comments ?? []).map(([authorId, body], n) => ({ id: uid(), authorId, body, at: iso(-(n + 1), 9 + n) })),
      attachments: (s.extras.files ?? []).map(name => ({ id: uid(), name, size: 184000, type: 'application/pdf', at: iso(-2) })),
      history: [{ id: uid(), at: iso(created), actorId: USER.hannah, text: 'created this' }],
      archived: false, createdAt: iso(created), createdBy: USER.hannah,
      completedAt: s.extras.done !== undefined ? iso(s.extras.done, 16) : undefined,
    };
  });
}
