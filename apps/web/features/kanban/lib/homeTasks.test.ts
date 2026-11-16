import { describe, expect, it } from 'vitest';
import type { ColumnKind, Task } from '../types';
import { taskCounts, taskSummary } from './homeTasks';

const kindOf = (t: Task): ColumnKind => (t.columnId === 'done' ? 'done' : t.columnId === 'doing' ? 'active' : 'open');
const task = (id: string, columnId: string, over: Partial<Task> = {}): Task => ({
  id, projectId: 'p1', columnId, title: id, description: '', priority: 'medium', tags: [], subtasks: [], comments: [],
  attachments: [], history: [], archived: false, createdAt: '2026-01-01T00:00:00Z', createdBy: 'u1', ...over,
});

describe('taskCounts', () => {
  it('counts live tasks by the same rules the boards use', () => {
    const tasks = [
      task('a', 'todo'),
      task('b', 'doing'),
      task('c', 'done', { completedAt: '2026-01-02T00:00:00Z' }),
      task('d', 'todo', { due: '2000-01-01' }),
      task('e', 'done', { archived: true }),
    ];
    expect(taskCounts(tasks, kindOf)).toEqual({ total: 4, inProgress: 1, completed: 1, overdue: 1 });
  });

  it('is all zeros for an empty workspace', () => {
    expect(taskCounts([], kindOf)).toEqual({ total: 0, inProgress: 0, completed: 0, overdue: 0 });
  });
});

describe('taskSummary', () => {
  it('asks for a first task when there are none', () => {
    expect(taskSummary({ total: 0, inProgress: 0, completed: 0, overdue: 0 })).toBe('No tasks yet. Create a project and add your first task.');
  });

  it('says what is in progress, done and overdue', () => {
    expect(taskSummary({ total: 8, inProgress: 3, completed: 2, overdue: 1 })).toBe('3 in progress, 2 of 8 done, 1 overdue.');
  });
});
