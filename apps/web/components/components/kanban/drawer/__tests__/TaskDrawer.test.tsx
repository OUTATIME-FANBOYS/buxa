import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@buxa/shared';
import { TaskDrawer } from '@/components/components/kanban/drawer/export';

const h = vi.hoisted(() => ({ drawer: null as null | { id: string }, store: {} }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({
  useTaskDrawer: () => ({ drawer: h.drawer, closeTask: () => undefined }),
}));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));

describe('TaskDrawer', () => {
  it('renders nothing while no task is open', () => {
    h.drawer = null;
    h.store = { s: buildSeed(), project: null };
    expect(renderToStaticMarkup(<TaskDrawer />)).toBe('');
  });
  it('renders nothing when the open task has gone', () => {
    h.drawer = { id: 'missing' };
    h.store = { s: buildSeed(), project: null };
    expect(renderToStaticMarkup(<TaskDrawer />)).toBe('');
  });
});
