import { describe, expect, it } from 'vitest';
import { taskActions } from '../tasks';
import { PROJECT } from '../../..';
import { buildSeed } from '../../..';
import { fakeContext } from './fakeContext';

describe('task actions', () => {
  it('creates a task in its column and returns the new id', () => {
    const seed = buildSeed();
    const ctx = fakeContext(seed);
    const project = seed.projects.find((p) => p.id === PROJECT.registration)!;
    const id = taskActions(ctx).createTask({ projectId: project.id, columnId: project.columns[0].id, title: 'Call the nurse', priority: 'low', tags: [] } as never);
    expect(id).toMatch(/^[a-z0-9]+$/);
    expect(ctx.get().tasks.some((t) => t.id === id && t.title === 'Call the nurse')).toBe(true);
  });
  it('adds and then toggles a subtask', () => {
    const seed = buildSeed();
    const ctx = fakeContext(seed);
    const actions = taskActions(ctx);
    const task = seed.tasks[0];
    actions.addSubtask(task.id, 'Check the list');
    const sub = ctx.get().tasks.find((t) => t.id === task.id)!.subtasks.at(-1)!;
    expect(sub.title).toBe('Check the list');
    expect(sub.done).toBe(false);
    actions.toggleSubtask(task.id, sub.id);
    expect(ctx.get().tasks.find((t) => t.id === task.id)!.subtasks.at(-1)!.done).toBe(true);
  });
  it('adds a comment to the task', () => {
    const seed = buildSeed();
    const ctx = fakeContext(seed);
    taskActions(ctx).addComment(seed.tasks[0].id, 'Looks good');
    const comments = ctx.get().tasks.find((t) => t.id === seed.tasks[0].id)!.comments;
    expect(comments.at(-1)?.body).toBe('Looks good');
  });
  it('archives a task and marks all notices read without error', () => {
    const seed = buildSeed();
    const ctx = fakeContext(seed);
    const actions = taskActions(ctx);
    actions.archiveTask(seed.tasks[0].id, true);
    expect(ctx.get().tasks.find((t) => t.id === seed.tasks[0].id)?.archived).toBe(true);
    expect(() => actions.markAllRead()).not.toThrow();
  });
});
