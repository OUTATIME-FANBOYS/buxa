import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AttendanceEntry } from '@buxa/contracts';
import { AttendanceHistory } from '@/components/components/people';

/** A check-in on the given day of July 2027, 09:00 UTC (10:00 in London). */
const visit = (day: number) =>
  ({
    id: `v-${day}`,
    checkedInAt: `2027-07-${String(day).padStart(2, '0')}T09:00:00.000Z`,
    checkedOutAt: null,
    checkedInByName: 'Rosa',
    collectedByName: null,
    overrideReason: null,
    note: null,
  }) as unknown as AttendanceEntry;

describe('AttendanceHistory', () => {
  it('says there are no check-ins yet when the list is empty', () => {
    expect(
      renderToStaticMarkup(<AttendanceHistory entries={[]} timeZone="Europe/London" clockFormat="24h" />),
    ).toContain('No check-ins yet.');
  });

  it('lists the date and time of each check-in, newest first', () => {
    const html = renderToStaticMarkup(
      <AttendanceHistory entries={[visit(3), visit(2)]} timeZone="Europe/London" clockFormat="24h" />,
    );
    expect(html).toContain('<li>3 Jul, 10:00</li>');
    expect(html.indexOf('3 Jul')).toBeLessThan(html.indexOf('2 Jul'));
  });

  it('lists at most five check-ins', () => {
    const entries = [7, 6, 5, 4, 3, 2, 1].map(visit);
    const html = renderToStaticMarkup(
      <AttendanceHistory entries={entries} timeZone="Europe/London" clockFormat="24h" />,
    );
    expect(html.match(/<li>/g)).toHaveLength(5);
    expect(html).not.toContain('1 Jul');
  });
});
