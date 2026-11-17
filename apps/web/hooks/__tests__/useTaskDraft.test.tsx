// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { useTaskDraft, type TaskDraft } from '../useTaskDraft';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown>, openTask: vi.fn() }));
vi.mock('@/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@/providers/TaskDrawerContext', () => ({ useTaskDrawer: () => ({ openTask: h.openTask }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const seed = buildSeed();
const project = seed.projects[0];
let d: TaskDraft | undefined;
function Probe({ task }: { task: (typeof seed.tasks)[number] | null }) { d = useTaskDraft(task, project, { columnId: project.columns[1].id }); return null; }

describe('useTaskDraft', () => {
  let root: Root;
  beforeEach(() => {
    d = undefined;
    h.store = { me: seed.users[0], actions: { createTask: vi.fn(() => 't-new'), updateTask: vi.fn() } };
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; });

  it('starts a new task in the column it was opened from, assigned to the signed-in person', () => {
    act(() => root.render(<UiProvider><Probe task={null} /></UiProvider>));
    expect(d!.isNew).toBe(true);
    expect(d!.columnId).toBe(project.columns[1].id);
    expect(d!.assignee).toBe(seed.users[0].id);
  });
  it('will not create a task without a title, and says why', () => {
    act(() => root.render(<UiProvider><Probe task={null} /></UiProvider>));
    act(() => d!.create());
    expect(d!.errs.title).toBeTruthy();
    expect((h.store.actions as { createTask: ReturnType<typeof vi.fn> }).createTask).not.toHaveBeenCalled();
  });
  it('creates a task with the entered title and opens it', () => {
    act(() => root.render(<UiProvider><Probe task={null} /></UiProvider>));
    act(() => d!.setTitle('Pack the first-aid kit'));
    act(() => d!.create());
    expect((h.store.actions as { createTask: ReturnType<typeof vi.fn> }).createTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pack the first-aid kit', projectId: project.id }));
    expect(h.openTask).toHaveBeenCalledWith('t-new');
  });
  it('writes a saved task’s title through to the store when it is left', () => {
    const task = seed.tasks[0];
    act(() => root.render(<UiProvider><Probe task={task} /></UiProvider>));
    act(() => d!.setTitle('A new title'));
    act(() => d!.commitTitle());
    expect((h.store.actions as { updateTask: ReturnType<typeof vi.fn> }).updateTask).toHaveBeenCalledWith(task.id, { title: 'A new title' });
  });
});
