import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '../../../UiProvider';
import { buildSeed } from '@/logic/common';
import { BoardView } from '../Board';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@/components/kanban/state/store', () => ({ useStore: () => h.store }));
vi.mock('@/components/kanban/state/TaskDrawerContext', () => ({ useTaskDrawer: () => ({ openTask: () => undefined }) }));
vi.mock('@/components/kanban/hooks/useTaskCommands', () => ({ useTaskCommands: () => ({ open() {}, duplicate() {}, moveTo() {}, toggleArchive() {}, remove() {} }) }));
vi.mock('@/components/kanban/hooks/useBoardDnd', () => ({
  useBoardDnd: () => ({ dnd: { mode: null, over: null, id: null }, scroller: { current: null }, grab: () => undefined, columnDrag: { over: () => undefined, drop: () => undefined, leave: () => undefined, start: () => undefined, end: () => undefined } }),
}));

const seed = buildSeed();
const project = seed.projects[0];
const tasks = seed.tasks.filter((t) => t.projectId === project.id);

describe('BoardView', () => {
  beforeEach(() => { h.store = { actions: {}, kindOf: () => 'open', userById: () => undefined }; });

  it('shows one labelled column per project column, with the task count', () => {
    const html = renderToStaticMarkup(<UiProvider><BoardView project={project} tasks={tasks} readOnly={false} manual /></UiProvider>);
    expect(html).toContain(`aria-label="${project.columns[0].name}, ${tasks.filter((t) => t.columnId === project.columns[0].id).length} tasks"`);
    expect(html.match(/<section data-col-id=/g)).toHaveLength(project.columns.length);
    expect(html).toContain(' Add column</button>');
  });
  it('hides every change for read-only members', () => {
    const html = renderToStaticMarkup(<UiProvider><BoardView project={project} tasks={tasks} readOnly manual={false} /></UiProvider>);
    expect(html).not.toContain('Add column');
    expect(html).not.toContain('Add task');
  });
});
