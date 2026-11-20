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

/** The chips and the "+N" / "Show less" control inside the day cell that holds the due date. */
const dayCell = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('[role="gridcell"]')).find(c => c.classList.contains('today'));
const chipsIn = (cell: HTMLElement | undefined) => cell?.querySelectorAll('.cal-task').length ?? 0;
const controlIn = (cell: HTMLElement | undefined, label: string) =>
  Array.from(cell?.querySelectorAll('button') ?? []).find(b => b.textContent === label);

describe('CalendarView: a day past five tasks', () => {
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

  it('a day with five tasks shows all five and no control', () => {
    render(tasks(5));
    expect(chipsIn(dayCell(container))).toBe(5);
    expect(dayCell(container)?.querySelector('.cal-more')).toBeNull();
  });

  it('a day with six tasks shows five, then all six in a scrollable list after "+1", then five after "Show less"', () => {
    render(tasks(6));
    expect(chipsIn(dayCell(container))).toBe(5);

    act(() => controlIn(dayCell(container), '+1')?.click());
    expect(chipsIn(dayCell(container))).toBe(6);
    expect(dayCell(container)?.querySelector('.cal-day-list')).not.toBeNull();
    expect(controlIn(dayCell(container), 'Show less')).toBeDefined();

    act(() => controlIn(dayCell(container), 'Show less')?.click());
    expect(chipsIn(dayCell(container))).toBe(5);
    expect(dayCell(container)?.querySelector('.cal-day-list')).toBeNull();
  });

  it('a day with seven tasks shows "+2", and all seven after it is clicked', () => {
    render(tasks(7));
    act(() => controlIn(dayCell(container), '+2')?.click());
    expect(chipsIn(dayCell(container))).toBe(7);
  });

  it('keeps the day number in its cell when the day is expanded', () => {
    render(tasks(7));
    act(() => controlIn(dayCell(container), '+2')?.click());
    expect(dayCell(container)?.querySelector('.cal-num span')?.textContent).toBe('10');
  });
});
