import { describe, expect, it } from 'vitest';
import { defaultSessionId, sessionsOpenOn, type CheckInSessionOption } from '../checkInSessions';

const TODAY = '2027-07-10';

describe('sessionsOpenOn', () => {
  it('offers a session in progress, one ending today, and one starting today', () => {
    const offered = sessionsOpenOn(
      [
        { id: 'in', name: 'In progress', startsOn: '2027-07-01', endsOn: '2027-07-31' },
        { id: 'ends', name: 'Ends today', startsOn: '2027-07-01', endsOn: TODAY },
        { id: 'starts', name: 'Starts today', startsOn: TODAY, endsOn: '2027-07-20' },
      ],
      TODAY,
    );

    expect(offered.map(o => o.id)).toEqual(['in', 'ends', 'starts']);
  });

  it('leaves out a session that is over, one that has not started, and one with no dates', () => {
    const offered = sessionsOpenOn(
      [
        { id: 'over', name: 'Over', startsOn: '2027-06-01', endsOn: '2027-07-09' },
        { id: 'later', name: 'Later', startsOn: '2027-07-11', endsOn: '2027-07-31' },
        { id: 'undated', name: 'Undated', startsOn: null, endsOn: null },
      ],
      TODAY,
    );

    expect(offered).toEqual([]);
  });

  it('keeps the order it was given and carries only the fields the screen needs', () => {
    const offered = sessionsOpenOn(
      [
        { id: 'b', name: 'B', startsOn: '2027-07-01', endsOn: '2027-07-31' },
        { id: 'a', name: 'A', startsOn: '2027-07-01', endsOn: '2027-07-31' },
      ],
      TODAY,
    );

    expect(offered).toEqual([
      { id: 'b', name: 'B', startsOn: '2027-07-01', endsOn: '2027-07-31' },
      { id: 'a', name: 'A', startsOn: '2027-07-01', endsOn: '2027-07-31' },
    ]);
  });
});

describe('defaultSessionId', () => {
  const one: CheckInSessionOption = { id: 'only', name: 'Only', startsOn: '2027-07-01', endsOn: '2027-07-31' };
  const two: CheckInSessionOption = { id: 'second', name: 'Second', startsOn: '2027-07-01', endsOn: '2027-07-31' };

  it('pre-selects the single session on offer', () => {
    expect(defaultSessionId([one])).toBe('only');
  });

  it('pre-selects nothing when there are several, or none', () => {
    expect(defaultSessionId([one, two])).toBeNull();
    expect(defaultSessionId([])).toBeNull();
  });
});
