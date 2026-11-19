import { describe, expect, it } from 'vitest';
import { classState } from '@/components/components/classes';

describe('classState', () => {
  it('says how many places are left, in words, with the ok tone', () => {
    expect(classState({ capacity: 12, seatsTaken: 3, waitlisted: 0 })).toEqual({
      label: '9 places left',
      tone: 'ok',
      full: false,
    });
    expect(classState({ capacity: 3, seatsTaken: 2, waitlisted: 0 }).label).toBe('1 place left');
  });

  it('says a full class is full, and mentions the waitlist when there is one', () => {
    expect(classState({ capacity: 3, seatsTaken: 3, waitlisted: 0 })).toEqual({
      label: 'Full',
      tone: 'warn',
      full: true,
    });
    expect(classState({ capacity: 3, seatsTaken: 3, waitlisted: 2 })).toEqual({
      label: 'Full, with a waitlist',
      tone: 'warn',
      full: true,
    });
  });
});
