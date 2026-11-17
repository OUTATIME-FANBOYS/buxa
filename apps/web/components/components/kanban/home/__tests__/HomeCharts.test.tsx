import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CheckInsByDay } from '@buxa/shared/camp/campHomeTypes';
import { CheckInsPanel } from '@/components/components/kanban/home/CheckInsPanel';
import { chartTotals, donutSegments, dayOfMonth, lastDays, shortDate, showAxisLabel } from '@/components/components/kanban/home/homeChartMath';

Object.assign(globalThis, { React });

/** Thirty days ending 17 Nov 2026, with a count per day from `counts` (the rest are zero). */
function series(counts: Record<string, number>, complete = true): CheckInsByDay {
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 10, 17 - (29 - i)));
    const date = d.toISOString().slice(0, 10);

    return { date, count: counts[date] ?? 0 };
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
    expect(html.match(/class="home-bar"/g)?.length).toBe(14);
  });

  it('labels every bar with its date for screen readers, and writes the count on the bar for short ranges', () => {
    const html = renderToStaticMarkup(<CheckInsPanel series={series({ '2026-11-17': 4 })} />);
    expect(html).toContain('aria-label="Check-ins per day, last 14 days"');
    expect(html).toContain('17 Nov: 4 people');
    expect(html).toContain('<span class="home-bar-value" aria-hidden="true">4</span>');
  });

  it('has a table alternative with every day of the range', () => {
    const html = renderToStaticMarkup(<CheckInsPanel series={series({ '2026-11-17': 4 })} />);
    expect(html).toContain('Show as a table');
    expect(html).toContain('<th scope="col">People checked in</th>');
    expect(html.match(/<tr><td>/g)?.length).toBe(14);
    expect(html).toContain('<tr><td>17 Nov</td><td>4</td></tr>');
  });

  it('says so, and draws no bars, when nobody checked in during the range', () => {
    const html = renderToStaticMarkup(<CheckInsPanel series={series({})} />);
    expect(html).toContain('No check-ins in the last 14 days.');
    expect(html).not.toContain('home-bars');
    expect(html).not.toContain('<table');
  });

  it('says attendance is not shown, with no chart, when the viewer may not read it', () => {
    const html = renderToStaticMarkup(<CheckInsPanel series={null} />);
    expect(html).toContain('Attendance is not shown for your role.');
    expect(html).not.toContain('home-bars');
  });

  it('warns that the older days may be short when the read was cut off', () => {
    const html = renderToStaticMarkup(<CheckInsPanel series={series({ '2026-11-17': 1 }, false)} />);
    expect(html).toContain('the older days may be short');
  });
});

describe('homeChartMath', () => {
  it('takes the last N days, oldest first', () => {
    const days = series({}).days;
    expect(lastDays(days, 7)).toHaveLength(7);
    expect(lastDays(days, 7)[6].date).toBe('2026-11-17');
  });

  it('totals a range and finds its busiest day, or none when it is quiet', () => {
    const days = [{ date: '2026-11-01', count: 2 }, { date: '2026-11-02', count: 5 }, { date: '2026-11-03', count: 5 }];
    expect(chartTotals(days)).toEqual({ total: 12, busiest: { date: '2026-11-02', count: 5 } });
    expect(chartTotals([{ date: '2026-11-01', count: 0 }]).busiest).toBeNull();
  });

  it('labels every bar of a short range, and every third bar of a long one, always with the last', () => {
    expect(showAxisLabel(0, 14) && showAxisLabel(13, 14)).toBe(true);
    expect([0, 1, 2, 3].filter(i => showAxisLabel(i, 30))).toEqual([0, 3]);
    expect(showAxisLabel(29, 30)).toBe(true);
  });

  it('formats dates without a zone shift', () => {
    expect(shortDate('2026-11-17')).toBe('17 Nov');
    expect(dayOfMonth('2026-11-04')).toBe('4');
  });
});

describe('donutSegments', () => {
  it('gives each non-empty status a dash of the ring, in order, with its share', () => {
    const segments = donutSegments({ valid: 3, notStarted: 0, expired: 1, none: 0 }, 100);
    expect(segments.map(s => s.key)).toEqual(['valid', 'expired']);
    expect(segments.map(s => s.percent)).toEqual([75, 25]);
    expect(segments[0].dash).toBeCloseTo(75);
    expect(segments[1].offset).toBeCloseTo(-75);
  });

  it('draws nothing for an empty camp', () => {
    expect(donutSegments({ valid: 0, notStarted: 0, expired: 0, none: 0 }, 100)).toEqual([]);
  });
});
