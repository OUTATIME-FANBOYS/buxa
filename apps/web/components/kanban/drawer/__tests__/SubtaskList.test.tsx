import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@buxa/shared';
import { type Task } from '@buxa/shared';
import { SubtaskList } from '../SubtaskList';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@/providers/store', () => ({ useStore: () => h.store }));

const task = { ...buildSeed().tasks[0], subtasks: [{ id: 's1', title: 'Book bus', done: true }, { id: 's2', title: 'Print lists', done: false }] } as unknown as Task;

describe('SubtaskList', () => {
  beforeEach(() => { h.store = { actions: {} }; });

  it('shows the progress in words and as a bar, with each subtask as a checkbox', () => {
    const html = renderToStaticMarkup(<SubtaskList task={task} ro={false} />);
    expect(html).toContain('1 of 2');
    expect(html).toContain('aria-label="Subtask progress"');
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Remove subtask Book bus"');
    expect(html).toContain('aria-label="New subtask"');
  });
  it('locks the checkboxes and hides the add form for read-only members', () => {
    const html = renderToStaticMarkup(<SubtaskList task={task} ro />);
    expect(html).not.toContain('New subtask');
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
});
