import { StubDialog } from '../../providers/__tests__/stubDialog';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '../../providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { type Task } from '@buxa/shared';
import { useTaskCommands, type TaskCommands } from '../useTaskCommands';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown>, openTask: vi.fn() }));
vi.mock('../../providers/store', () => ({ useStore: () => h.store }));
vi.mock('../../providers/TaskDrawerContext', () => ({ useTaskDrawer: () => ({ openTask: h.openTask }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let cmd: TaskCommands | undefined;

function Probe() {
  cmd = useTaskCommands();

  return null;
}

describe('useTaskCommands', () => {
  let root: Root;
  const seed = buildSeed();
  const task = seed.tasks[0] as Task;
  beforeEach(() => {
    cmd = undefined;
    h.store = { actions: { deleteTask: vi.fn(), restoreTask: vi.fn(), moveTask: vi.fn(), archiveTask: vi.fn(), duplicateTask: vi.fn(() => 't-copy') } };
    root = createRoot(document.body.appendChild(document.createElement('div')));
    act(() => root.render(<UiProvider Dialog={StubDialog}><Probe /></UiProvider>));
  });
  afterEach(() => {
    act(() => root.unmount()); document.body.innerHTML = '';
  });

  it('deletes a task and offers to undo', () => {
    act(() => cmd!.remove(task));
    expect((h.store.actions as { deleteTask: ReturnType<typeof vi.fn> }).deleteTask).toHaveBeenCalledWith(task.id);
    expect(document.querySelector('.toast')?.textContent).toContain('Task deleted');
    act(() => (document.querySelector('.toast button') as HTMLButtonElement).click());
    expect((h.store.actions as { restoreTask: ReturnType<typeof vi.fn> }).restoreTask).toHaveBeenCalledWith(task);
  });
  it('archives or restores with a matching message', () => {
    act(() => cmd!.toggleArchive(task));
    expect((h.store.actions as { archiveTask: ReturnType<typeof vi.fn> }).archiveTask).toHaveBeenCalledWith(task.id, true);
    expect(document.body.textContent).toContain('Task archived');
  });
  it('duplicates a task and returns the copy’s id', () => {
    let copy: string | undefined;
    act(() => {
      copy = cmd!.duplicate(task);
    });
    expect(copy).toBe('t-copy');
  });
  it('moves a task to another column', () => {
    act(() => cmd!.moveTo(task, seed.projects[0].columns[2]));
    expect((h.store.actions as { moveTask: ReturnType<typeof vi.fn> }).moveTask).toHaveBeenCalledWith(task.id, seed.projects[0].columns[2].id, null);
  });
  it('opens a task in the drawer', () => {
    act(() => cmd!.open(task));
    expect(h.openTask).toHaveBeenCalledWith(task.id);
  });
});
