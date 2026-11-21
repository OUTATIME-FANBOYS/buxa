// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarView } from '@/components/components/kanban/board-views/CalendarView';
import { MonthYearJump, yearOptions, YEAR_SPAN } from '@/components/components/kanban/board-views/MonthYearJump';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({
  useTaskDrawer: () => ({ openTask: () => undefined }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Sets a select's value and fires the change event React listens for. */
function choose(select: HTMLSelectElement, value: string) {
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('yearOptions', () => {
  it('covers the current year minus and plus five', () => {
    const years = yearOptions(2027, 2027).map(option => option.value);
    expect(years[0]).toBe(String(2027 - YEAR_SPAN));
    expect(years[years.length - 1]).toBe(String(2027 + YEAR_SPAN));
    expect(years).toHaveLength(2 * YEAR_SPAN + 1);
  });

  it('adds the year on screen when it is outside that range, so it stays selectable', () => {
    const years = yearOptions(2027, 2040).map(option => option.value);
    expect(years).toContain('2040');
  });
});

describe('MonthYearJump: the month and year pickers', () => {
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

  const selects = () => Array.from(container.querySelectorAll<HTMLSelectElement>('.cal-jump select'));
  const heading = () => container.querySelector('h2')?.textContent;

  it('selects the current month and year on load', () => {
    act(() => {
      root.render(<CalendarView tasks={[]} canCreate={false} />);
    });
    const [month, year] = selects();
    expect(month?.value).toBe('6');
    expect(month?.options[6]?.textContent).toBe('July');
    expect(year?.value).toBe('2027');
    expect(heading()).toBe('July 2027');
  });

  it('a change of month moves the calendar to that month, in the same year', () => {
    act(() => {
      root.render(<CalendarView tasks={[]} canCreate={false} />);
    });
    choose(selects()[0], '8');
    expect(heading()).toBe('September 2027');
    expect(selects()[1]?.value).toBe('2027');
  });

  it('a change of year moves the calendar to that year, in the same month', () => {
    act(() => {
      root.render(<CalendarView tasks={[]} canCreate={false} />);
    });
    choose(selects()[1], '2030');
    expect(heading()).toBe('July 2030');
    expect(selects()[0]?.value).toBe('6');
  });

  it('Today, Previous and Next still move the calendar', () => {
    act(() => {
      root.render(<CalendarView tasks={[]} canCreate={false} />);
    });
    const button = (label: string) =>
      Array.from(container.querySelectorAll('button')).find(
        b => b.textContent === label || b.getAttribute('aria-label') === label,
      );
    act(() => button('Next month')?.click());
    expect(heading()).toBe('August 2027');
    act(() => button('Previous month')?.click());
    act(() => button('Previous month')?.click());
    expect(heading()).toBe('June 2027');
    choose(selects()[0], '0');
    act(() => button('Today')?.click());
    expect(heading()).toBe('July 2027');
  });

  it('renders the month picker alone with its month selected', () => {
    act(() => {
      root.render(<MonthYearJump cursor={new Date(2027, 2, 1)} onMove={() => undefined} />);
    });
    expect(selects()[0]?.value).toBe('2');
    expect(selects()[0]?.options).toHaveLength(12);
  });
});
