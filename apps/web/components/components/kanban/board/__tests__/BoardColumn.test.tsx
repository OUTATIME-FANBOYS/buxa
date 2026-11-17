import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@buxa/shared';
import { BoardColumn, type BoardColumnProps } from '@/components/components/kanban/board/export';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({ useTaskDrawer: () => ({ openTask: () => undefined }) }));
vi.mock('@buxa/middleware/hooks/useTaskCommands', () => ({ useTaskCommands: () => ({ open() {}, duplicate() {}, moveTo() {}, toggleArchive() {}, remove() {} }) }));

const seed = buildSeed();
const project = seed.projects[0];
const column = project.columns[0];
const noop = () => undefined;
const base: BoardColumnProps = {
  col: column, index: 0, project, items: [], readOnly: false, dnd: { mode: null, over: null, id: null } as never, adding: false,
  columnDrag: { over: noop, drop: noop, leave: noop, start: noop, end: noop } as never, onGrab: noop, onAdd: noop, onStopAdding: noop, onEdit: noop, onRemove: noop,
};

describe('BoardColumn', () => {
  beforeEach(() => {
    h.store = { actions: {} };
  });

  it('names the column and its count, and offers to add a task', () => {
    const html = renderToStaticMarkup(<BoardColumn {...base} />);
    expect(html).toContain(`<h2>${column.name}</h2>`);
    expect(html).toContain('aria-label="Add task to ' + column.name + '"');
    expect(html).toContain('Drop tasks here');
  });
  it('says an empty column is empty for a read-only reader, with no controls', () => {
    const html = renderToStaticMarkup(<BoardColumn {...base} readOnly />);
    expect(html).toContain('Nothing here');
    expect(html).not.toContain('Add task');
  });
  it('shows the quick-add box while adding a task', () => {
    expect(renderToStaticMarkup(<BoardColumn {...base} adding />)).toContain('What needs doing?');
  });
});
