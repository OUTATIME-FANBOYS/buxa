// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '@buxa/shared';
import { CalendarView } from '@/components/components/kanban/board-views';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({
  useTaskDrawer: () => ({ openTask: () => undefined }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const seed = buildSeed();
const DUE = '2027-07-10';

function tasks(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    ...seed.tasks[0],
    id: `t-${i}`,
    title: `Task ${i + 1}`,
    due: DUE,
  }));
}

/** The chips and the "+N more" / "Show less" control inside the day cell that holds the due date. */
const dayCell = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('[role="gridcell"]')).find(c => c.classList.contains('today'));
const chipsIn = (cell: HTMLElement | undefined) => cell?.querySelectorAll('.cal-task').length ?? 0;
const controlIn = (cell: HTMLElement | undefined, label: string) =>
  Array.from(cell?.querySelectorAll('button') ?? []).find(b => b.textContent === label);

describe('CalendarView "+N more" expands the day in place', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 6, 10, 12));
    h.store = { kindOf: () => 'open' };
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const render = (list: ReturnType<typeof tasks>) =>
    act(() => {
      root.render(<CalendarView tasks={list} canCreate={false} />);
    });

  it('a day with 4 tasks shows 3, then all 4 after "+1 more", then 3 again after "Show less"', () => {
    render(tasks(4));
    expect(chipsIn(dayCell(container))).toBe(3);

    act(() => controlIn(dayCell(container), '+1 more')?.click());
    expect(chipsIn(dayCell(container))).toBe(4);
    expect(controlIn(dayCell(container), 'Show less')).toBeDefined();

    act(() => controlIn(dayCell(container), 'Show less')?.click());
    expect(chipsIn(dayCell(container))).toBe(3);
  });

  it('a day with 7 tasks shows 3, then all 7 after "+4 more"', () => {
    render(tasks(7));
    expect(chipsIn(dayCell(container))).toBe(3);

    act(() => controlIn(dayCell(container), '+4 more')?.click());
    expect(chipsIn(dayCell(container))).toBe(7);
  });

  it('keeps the day number in its cell when the day is expanded', () => {
    render(tasks(7));
    act(() => controlIn(dayCell(container), '+4 more')?.click());
    expect(dayCell(container)?.querySelector('.cal-num span')?.textContent).toBe('10');
  });
});
