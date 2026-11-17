import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Session } from '@buxa/contracts';
import { SessionTable } from '../SessionTable';

const CLASS_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

const session = (over: Partial<Session> = {}): Session => ({
  id: SESSION_ID, classId: CLASS_ID, className: 'Robotics',
  // 09:00 to 12:00 on Monday 5 July 2027 in Sydney (UTC+10).
  startsAt: '2027-07-04T23:00:00.000Z', endsAt: '2027-07-05T02:00:00.000Z',
  location: 'Lab 1', instructorIds: [], capacity: 8, seatsTaken: 5, waitlisted: 0, ...over,
});

describe('SessionTable', () => {
  it('shows the times in the camp zone, not in UTC', () => {
    const html = renderToStaticMarkup(<SessionTable classId={CLASS_ID} sessions={[session()]} timeZone="Australia/Sydney" selectedId={null} />);
    expect(html).toContain('5 Jul, 09:00');
    expect(html).toContain('5 Jul, 12:00');
    expect(html).not.toContain('23:00');
  });

  it('shows capacity, enrolled, waitlisted and places, with headers for each', () => {
    const html = renderToStaticMarkup(<SessionTable classId={CLASS_ID} sessions={[session({ waitlisted: 2 })]} timeZone="Australia/Sydney" selectedId={null} />);
    for (const header of ['Starts', 'Ends', 'Location', 'Capacity', 'Enrolled', 'Waitlisted', 'Places']) {
      expect(html).toContain(`<th scope="col">${header}</th>`);
    }
    expect(html).toContain('3 places left');
  });

  it('links each session to its enrolments on the same page, and marks the one shown', () => {
    const html = renderToStaticMarkup(<SessionTable classId={CLASS_ID} sessions={[session()]} timeZone="Australia/Sydney" selectedId={SESSION_ID} />);
    expect(html).toContain(`href="/camp/classes/${CLASS_ID}?session=${SESSION_ID}#enrolments"`);
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('Showing enrolments');
  });
});
