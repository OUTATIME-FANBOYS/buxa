import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@buxa/shared';
import { TimelineView } from '@/components/components/kanban/board-views/export';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({ useTaskDrawer: () => ({ openTask: () => undefined }) }));

const seed = buildSeed();

describe('TimelineView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 6, 10, 12));
    h.store = { kindOf: () => 'open', userById: () => undefined };
  });
  afterEach(() => vi.useRealTimers());

  it('draws a day header and a bar for a task with a start and an end', () => {
    const task = { ...seed.tasks[0], start: '2027-07-08', due: '2027-07-12' };
    const html = renderToStaticMarkup(<TimelineView tasks={[task]} />);
    expect(html).toContain('tl-header');
    expect(html).toContain(`aria-label="${task.title}, `);
  });
});
