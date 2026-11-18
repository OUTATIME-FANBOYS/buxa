import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SessionStatus, sessionState } from '@/components/components/classes';

describe('sessionState', () => {
  it.each([
    [{ capacity: 10, seatsTaken: 4, waitlisted: 0 }, '6 places left', false],
    [{ capacity: 10, seatsTaken: 9, waitlisted: 0 }, '1 place left', false],
    [{ capacity: 10, seatsTaken: 10, waitlisted: 0 }, 'Full', true],
    [{ capacity: 10, seatsTaken: 10, waitlisted: 3 }, 'Full, with a waitlist', true],
  ])('reads %j as "%s"', (session, label, full) => {
    expect(sessionState(session)).toMatchObject({ label, full });
  });

  it('uses a word, not colour alone, for a full session', () => {
    expect(renderToStaticMarkup(<SessionStatus session={{ capacity: 2, seatsTaken: 2, waitlisted: 0 }} />)).toContain(
      'Full',
    );
  });
});
