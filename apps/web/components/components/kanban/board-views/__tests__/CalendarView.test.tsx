import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@buxa/shared';
import { CalendarView } from '@/components/components/kanban/board-views';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({
  useTaskDrawer: () => ({ openTask: () => undefined }),
}));

const seed = buildSeed();

describe('CalendarView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 6, 10, 12));
    h.store = { kindOf: () => 'open' };
  });
  afterEach(() => vi.useRealTimers());

  it('shows the month of the cursor and a six-week grid of days with Monday first', () => {
    const html = renderToStaticMarkup(<CalendarView tasks={[]} canCreate={false} />);
    expect(html).toContain('<h2>July 2027</h2>');
    expect(html.match(/role="gridcell"/g)).toHaveLength(42);
    expect(html.indexOf('>Mon<')).toBeLessThan(html.indexOf('>Sun<'));
    expect(html).toContain('aria-label="Previous month"');
    expect(html).toContain('aria-label="Next month"');
  });
  it('marks today and places a task on its due day', () => {
    const task = { ...seed.tasks[0], due: '2027-07-10' };
    const html = renderToStaticMarkup(<CalendarView tasks={[task]} canCreate={false} />);
    expect(html).toContain('today');
    expect(html).toContain(task.title);
  });
  it('gives each pill its full title on hover and its priority as an icon named for screen readers', () => {
    const task = { ...seed.tasks[0], title: 'Plan the trip', priority: 'high' as const, due: '2027-07-10' };
    const html = renderToStaticMarkup(<CalendarView tasks={[task]} canCreate={false} />);
    expect(html).toContain('title="Plan the trip"');
    expect(html).toMatch(/class="button button--ghost button--sm cal-task[ "]/);
    expect(html).toMatch(/<svg[^>]*class="[^"]*text-\[var\(--p-high\)\][^"]*cal-dot"/);
  });
  it('leaves every pill untinted: its body is the surface, and only the priority icon carries colour', () => {
    const base = { ...seed.tasks[0], priority: 'high' as const, due: '2027-07-10' };
    const html = renderToStaticMarkup(<CalendarView tasks={[base]} canCreate={false} />);
    expect(html).not.toMatch(/cal-type-/);
    expect(html).not.toMatch(/prio-bg-/);
  });
});
