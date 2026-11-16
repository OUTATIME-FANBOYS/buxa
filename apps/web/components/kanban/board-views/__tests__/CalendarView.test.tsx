import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@/logic/common';
import { CalendarView } from '../CalendarView';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@/components/kanban/state/store', () => ({ useStore: () => h.store }));
vi.mock('@/components/kanban/state/TaskDrawerContext', () => ({ useTaskDrawer: () => ({ openTask: () => undefined }) }));

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
});
