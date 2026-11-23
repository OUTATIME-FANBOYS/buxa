import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CheckInsByDay } from '@buxa/shared/camp/campHomeTypes';
import { CheckInsPanel } from '@/components/components/kanban/home/CheckInsPanel';
import { chartTotals, dayOfMonth, lastDays, shortDate } from '@/components/components/kanban/home/homeChartMath';

Object.assign(globalThis, { React });

/**
 * Sixty days ending 17 Nov 2026, with a count per day from `counts` (the rest are zero). `minors` gives the students per day; without
 * it the split is not shown (null), as for a viewer who may not see the minor flag.
 */
function series(
  counts: Record<string, number>,
  complete = true,
  minors: Record<string, number> | null = null,
): CheckInsByDay {
  const days = Array.from({ length: 60 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 10, 17 - (59 - i)));
    const date = d.toISOString().slice(0, 10);

    return { date, count: counts[date] ?? 0, minors: minors === null ? null : (minors[date] ?? 0) };
  });

  return { days, complete };
}

describe('CheckInsPanel', () => {
  it('shows the last 14 days by default, with a title, a range picker and a total in words', () => {
    const html = renderToStaticMarkup(<CheckInsPanel series={series({ '2026-11-17': 4, '2026-11-16': 2 })} />);
    expect(html).toContain('Check-ins per day');
    expect(html).toContain('aria-label="Date range"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('6 people checked in from 4 Nov to 17 Nov.');
    expect(html).toContain('Busiest day: 17 Nov, 4.');
  });

  it('draws the days with Bars: one column per day with a value, and day-of-month axis labels', () => {
    const html = renderToStaticMarkup(<CheckInsPanel series={series({ '2026-11-17': 4 })} />);
    expect(html).toContain('<svg width="640"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Check-ins per day, last 14 days, 4 in total"');
    // Only the one day with a count draws a column; the first day's label is always written (Bars thins the rest).
    expect(html.match(/class="chart-bar"/g)?.length).toBe(1);
    expect(html).toContain('class="axis">4</text>');
  });

  it('has a table alternative with every day of the range', () => {
    const html = renderToStaticMarkup(<CheckInsPanel series={series({ '2026-11-17': 4 })} />);
    expect(html).toContain('Show as a table');
    expect(html).toContain('<th scope="col">People checked in</th>');
    expect(html.match(/<tr><td>/g)?.length).toBe(14);
    expect(html).toContain('<tr><td>17 Nov</td><td>4</td></tr>');
  });

  it('says so, and draws no chart, when nobody checked in during the range', () => {
    const html = renderToStaticMarkup(<CheckInsPanel series={series({})} />);
    expect(html).toContain('No check-ins in the last 14 days.');
    expect(html).not.toContain('aria-label="Check-ins per day, last 14 days');
    expect(html).not.toContain('<table');
  });

  it('says attendance is not shown, with no chart, when the viewer may not read it', () => {
    const html = renderToStaticMarkup(<CheckInsPanel series={null} />);
    expect(html).toContain('Attendance is not shown for your role.');
    expect(html).not.toContain('<svg');
  });

  it('warns that the older days may be short when the read was cut off', () => {
    const html = renderToStaticMarkup(<CheckInsPanel series={series({ '2026-11-17': 1 }, false)} />);
    expect(html).toContain('the older days may be short');
  });

  it('shows the change against the period before, as a chip', () => {
    // Last 14 days: 8. The 14 days before: 0. So it is a plain count up.
    const html = renderToStaticMarkup(
      <CheckInsPanel series={series({ '2026-11-17': 5, '2026-11-16': 3 }, true, { '2026-11-17': 2 })} />,
    );
    expect(html).toContain('+8 vs previous 14 days');
  });

  it('keeps the parents and students split in the table, with the total', () => {
    const html = renderToStaticMarkup(
      <CheckInsPanel series={series({ '2026-11-17': 5, '2026-11-16': 3 }, true, { '2026-11-17': 2 })} />,
    );
    expect(html).toContain('<th scope="col">Students</th>');
    expect(html).toContain('<tr><td>17 Nov</td><td>3</td><td>2</td><td>5</td></tr>');
    expect(html).not.toContain('is not shown for your role');
  });

  it('says the split is not shown, and has no students column, without the minor flag', () => {
    const html = renderToStaticMarkup(<CheckInsPanel series={series({ '2026-11-17': 5 })} />);
    expect(html).not.toContain('<th scope="col">Students</th>');
    expect(html).toContain('The split between Parent/Guardians and Students is not shown for your role.');
  });
});

describe('homeChartMath', () => {
  it('takes the last N days, oldest first', () => {
    const days = series({}).days;
    expect(lastDays(days, 7)).toHaveLength(7);
    expect(lastDays(days, 7)[6].date).toBe('2026-11-17');
  });

  it('totals a range and finds its busiest day, or none when it is quiet', () => {
    const days = [
      { date: '2026-11-01', count: 2, minors: null },
      { date: '2026-11-02', count: 5, minors: null },
      { date: '2026-11-03', count: 5, minors: null },
    ];
    expect(chartTotals(days)).toEqual({ total: 12, busiest: { date: '2026-11-02', count: 5, minors: null } });
    expect(chartTotals([{ date: '2026-11-01', count: 0, minors: null }]).busiest).toBeNull();
  });

  it('formats dates without a zone shift', () => {
    expect(shortDate('2026-11-17')).toBe('17 Nov');
    expect(dayOfMonth('2026-11-04')).toBe('4');
  });
});
