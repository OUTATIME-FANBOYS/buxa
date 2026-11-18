import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AttendanceEntry } from '@buxa/contracts';
import { LogTable } from '@/components/components/attendance/export';

const entry = {
  id: 'v-1',
  personName: 'Mia Cole',
  checkedInAt: '2027-07-03T09:00:00.000Z',
  checkedOutAt: null,
  checkedInByName: 'Rosa',
  checkedOutByName: null,
  collectedByName: null,
  method: 'qr',
  overrideReason: null,
} as unknown as AttendanceEntry;

describe('LogTable', () => {
  it('shows one row per visit, with the person, the method and dashes for empty fields', () => {
    const html = renderToStaticMarkup(<LogTable entries={[entry]} timeZone="Europe/London" clockFormat="24h" />);
    expect(html).toContain('<th scope="row">Mia Cole</th>');
    expect(html).toContain('<td data-label="Method">Badge</td>');
    expect(html).toContain('<td data-label="Checked out by">—</td>');
  });
  it('marks a visit with no check-out as on site', () => {
    expect(renderToStaticMarkup(<LogTable entries={[entry]} timeZone="Europe/London" clockFormat="24h" />)).toContain(
      '>On site</td>',
    );
  });
  it('shows the check-out time when there is one', () => {
    const out = {
      ...entry,
      checkedOutAt: '2027-07-03T11:30:00.000Z',
      checkedOutByName: 'Tom',
      collectedByName: 'Jo Cole',
    } as unknown as AttendanceEntry;
    const html = renderToStaticMarkup(<LogTable entries={[out]} timeZone="Europe/London" clockFormat="24h" />);
    expect(html).not.toContain('On site');
    expect(html).toContain('<td data-label="Collected by">Jo Cole</td>');
  });
});
