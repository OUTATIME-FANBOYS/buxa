import { Dialog as ConfirmDialog } from '@/components/components';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { TaskForm } from '@/components/components/kanban/drawer';
import { requirePresent } from '@buxa/domain';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({
  useTaskDrawer: () => ({ openTask: () => undefined }),
}));
vi.mock('@buxa/middleware/hooks/useTaskCommands', () => ({
  useTaskCommands: () => ({ open() {}, duplicate() {}, moveTo() {}, toggleArchive() {}, remove() {} }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const seed = buildSeed();
const project = seed.projects[0];

describe('TaskForm', () => {
  let root: Root;
  beforeEach(() => {
    h.store = {
      actions: { createTask: vi.fn(() => 't-new'), updateTask: vi.fn() },
      readOnly: false,
      members: [],
      userById: () => undefined,
      me: seed.users[0],
      kindOf: () => 'open',
      wsTasks: seed.tasks,
      s: seed,
      project,
    };
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('opens a new task as a drawer with a title box and a Create action', () => {
    act(() =>
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <TaskForm task={null} project={project} onClose={() => undefined} />
        </UiProvider>,
      ),
    );
    const dialog = requirePresent(
      document.querySelector('[role="dialog"]'),
      'document.querySelector(\'[role="dialog"]\')',
    );
    expect(dialog.className).toContain('drawer');
    expect(dialog.querySelector('#drawer-title')?.getAttribute('placeholder')).toBe('Task title');
    expect(dialog.textContent).toContain('New task');
    expect(dialog.querySelector('.sticky-foot')).not.toBeNull();
  });
  it('locks the whole form for read-only members', () => {
    h.store = { ...h.store, readOnly: true };
    act(() =>
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <TaskForm task={seed.tasks[0]} project={project} onClose={() => undefined} />
        </UiProvider>,
      ),
    );
    const fieldset = requirePresent(document.querySelector('fieldset'), "document.querySelector('fieldset')");
    expect(fieldset.disabled).toBe(true);
  });
});
