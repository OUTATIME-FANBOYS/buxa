import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/actions/classes', () => ({ promoteWaitlistAction: vi.fn() }));

import { ClassHoldsAndWaitlist } from '@/components/components/classes/ClassHoldsAndWaitlist';

const base = {
  sessionId: 'session-1',
  classId: 'class-1',
  holds: [{ id: 'h1', householdName: 'Lovelace household', expiresAt: '2027-07-10T09:15:00.000Z' }],
  timeZone: 'UTC',
  clockFormat: '24h' as const,
};

describe('ClassHoldsAndWaitlist', () => {
  it('lists the waitlist in the order the campers joined, not the order given', () => {
    const html = renderToStaticMarkup(
      <ClassHoldsAndWaitlist
        {...base}
        freePlaces={0}
        waitlist={[
          { id: 'w2', camperName: 'Second Joiner', enrolledAt: '2027-07-01T10:00:00.000Z' },
          { id: 'w1', camperName: 'First Joiner', enrolledAt: '2027-06-30T10:00:00.000Z' },
        ]}
      />,
    );
    expect(html.indexOf('First Joiner')).toBeLessThan(html.indexOf('Second Joiner'));
    expect(html).toContain('Waitlist, in order');
  });

  it('shows the held places with the household and when each hold runs out', () => {
    const html = renderToStaticMarkup(<ClassHoldsAndWaitlist {...base} freePlaces={1} waitlist={[]} />);
    expect(html).toContain('Lovelace household');
    expect(html).toContain('Held until');
    expect(html).toContain('Nobody is on the waitlist.');
  });

  it('offers the promote button only when there is someone to move, and says why it is off when no place is free', () => {
    const withWaiting = renderToStaticMarkup(
      <ClassHoldsAndWaitlist
        {...base}
        freePlaces={0}
        waitlist={[{ id: 'w1', camperName: 'Waiting Camper', enrolledAt: '2027-06-30T10:00:00.000Z' }]}
      />,
    );
    expect(withWaiting).toContain('Move the next camper off the waitlist');
    expect(withWaiting).toContain('No place is free.');
    expect(withWaiting).toMatch(/<button[^>]*disabled/);

    const nobody = renderToStaticMarkup(<ClassHoldsAndWaitlist {...base} freePlaces={2} waitlist={[]} />);
    expect(nobody).not.toContain('Move the next camper');
  });
});
