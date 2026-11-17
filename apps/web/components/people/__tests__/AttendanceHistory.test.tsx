import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AttendanceEntry } from '@buxa/contracts';
import { AttendanceHistory } from '../AttendanceHistory';

const visit = { id: 'v-1', checkedInAt: '2027-07-03T09:00:00.000Z', checkedOutAt: null, checkedInByName: 'Rosa', collectedByName: null, overrideReason: 'Agreed', note: 'Bring a coat' } as unknown as AttendanceEntry;

describe('AttendanceHistory', () => {
  it('says there are no visits yet when the list is empty', () => {
    expect(renderToStaticMarkup(<AttendanceHistory entries={[]} timeZone="Europe/London" />)).toContain('No visits yet.');
  });
  it('lists each visit with who checked the person in, the override and the note', () => {
    const html = renderToStaticMarkup(<AttendanceHistory entries={[visit]} timeZone="Europe/London" />);
    expect(html).toContain('<td>Rosa</td>');
    expect(html).toContain('Override: Agreed · Bring a coat');
    expect(html).toContain('On site');
  });
});
