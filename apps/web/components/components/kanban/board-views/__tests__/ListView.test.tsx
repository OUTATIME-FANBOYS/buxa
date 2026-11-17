import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@buxa/shared';
import { ListView } from '@/components/components/kanban/board-views/export';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({ useTaskDrawer: () => ({ openTask: () => undefined }) }));

const seed = buildSeed();

describe('ListView', () => {
  beforeEach(() => {
    h.store = { actions: {}, userById: (id?: string) => seed.users.find((u) => u.id === id), kindOf: () => 'open' };
  });

  it('says there is nothing to show when no task matches', () => {
    expect(renderToStaticMarkup(<ListView tasks={[]} projects={seed.projects} readOnly={false} />)).toContain('No tasks to show');
  });
  it('lists each task as a row, with sortable column headers', () => {
    const html = renderToStaticMarkup(<ListView tasks={seed.tasks.slice(0, 3)} projects={seed.projects} readOnly={false} />);
    expect(html).toContain('<table');
    expect(html).toContain('aria-sort="none"');
    expect(html.match(/<tr class=""/g)?.length ?? html.match(/<tr>/g)?.length).toBeGreaterThanOrEqual(3);
    expect(html).toContain(seed.tasks[0].title);
  });
  it('makes the completion box read-only for read-only members', () => {
    const html = renderToStaticMarkup(<ListView tasks={seed.tasks.slice(0, 1)} projects={seed.projects} readOnly />);
    expect(html).toContain('disabled=""');
  });
});
