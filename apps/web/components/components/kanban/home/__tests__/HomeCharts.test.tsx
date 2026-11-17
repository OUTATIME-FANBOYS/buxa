import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CheckInsByDay } from '@buxa/shared/camp/campHomeTypes';
import { CheckInsPanel } from '@/components/components/kanban/home/CheckInsPanel';
import { chartTotals, donutSegments, dayOfMonth, lastDays, shortDate, showAxisLabel } from '@/components/components/kanban/home/homeChartMath';

Object.assign(globalThis, { React });

/**
 * Sixty days ending 17 Nov 2026, with a count per day from `counts` (the rest are zero). `minors` gives the students per day; without
 * it the split is not shown (null), as for a viewer who may not see the minor flag.
 */
function series(counts: Record<string, number>, complete = true, minors: Record<string, number> | null = null): CheckInsByDay {
  const days = Array.from({ length: 60 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 10, 17 - (59 - i)));
    const date = d.toISOString().slice(0, 10);

    return { date, count: counts[date] ?? 0, minors: minors === null ? null : minors[date] ?? 0 };
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
    const days = [{ date: '2026-11-01', count: 2, minors: null }, { date: '2026-11-02', count: 5, minors: null }, { date: '2026-11-03', count: 5, minors: null }];
    expect(chartTotals(days)).toEqual({ total: 12, busiest: { date: '2026-11-02', count: 5, minors: null } });
    expect(chartTotals([{ date: '2026-11-01', count: 0, minors: null }]).busiest).toBeNull();
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

describe('CheckInsPanel as stacked columns', () => {
  // 17 Nov: 5 people, 2 of them students. 16 Nov: 3 people, none students. The peak is 5, so 17 Nov fills the column.
  const stacked = () => series({ '2026-11-17': 5, '2026-11-16': 3 }, true, { '2026-11-17': 2 });

  it('writes each day total above its column, and splits the column into parents and students', () => {
    const html = renderToStaticMarkup(<CheckInsPanel series={stacked()} />);
    expect(html).toContain('<span class="home-bar-value" aria-hidden="true">5</span>');
    expect(html).toContain('<span class="home-bar-value" aria-hidden="true">3</span>');
    expect(html).toContain('<span class="home-seg home-seg-students" style="flex-grow:2"></span>');
    expect(html).toContain('<span class="home-seg home-seg-parents" style="flex-grow:3"></span>');
    expect(html).toContain('<span class="home-stack-col" style="height:100%">');
    expect(html).toContain('<span class="home-stack-col" style="height:60%">');
  });

  it('reads each day aloud with its split, and the stacked totals add to the summary', () => {
    const html = renderToStaticMarkup(<CheckInsPanel series={stacked()} />);
    expect(html).toContain('17 Nov: 5 people (Parent/Guardians 3, Students 2)');
    expect(html).toContain('8 people checked in from 4 Nov to 17 Nov.');
  });

  it('draws a band behind the columns, and a legend that names both groups', () => {
    const html = renderToStaticMarkup(<CheckInsPanel series={stacked()} />);
    expect(html).toContain('<svg class="home-band"');
    expect(html).toContain('<polygon points="0,100 ');
    expect(html).toContain('aria-label="Legend"');
    expect(html).toContain('<span class="home-sw home-seg-parents" aria-hidden="true"></span>Parent/Guardians');
    expect(html).toContain('<span class="home-sw home-seg-students" aria-hidden="true"></span>Students');
  });

  it('shows the split in the table alternative, with the total', () => {
    const html = renderToStaticMarkup(<CheckInsPanel series={stacked()} />);
    expect(html).toContain('<th scope="col">Students</th>');
    expect(html).toContain('<tr><td>17 Nov</td><td>3</td><td>2</td><td>5</td></tr>');
  });

  it('shows the change against the period before, as a chip', () => {
    // Last 14 days: 8. The 14 days before: 0. So it is a plain count up.
    const html = renderToStaticMarkup(<CheckInsPanel series={stacked()} />);
    expect(html).toContain('+8 vs previous 14 days');
  });

  it('says the split is not shown, and draws no students, without the minor flag', () => {
    const html = renderToStaticMarkup(<CheckInsPanel series={series({ '2026-11-17': 5 })} />);
    expect(html).not.toContain('home-seg-students');
    expect(html).toContain('The split between Parent/Guardians and Students is not shown for your role.');
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
