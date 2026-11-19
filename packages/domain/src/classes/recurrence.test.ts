import { describe, expect, it } from 'vitest';
import { expandClassRule, MAX_RECURRING_CLASSES, type ClassRule } from './recurrence';

const SYDNEY = 'Australia/Sydney';
const NEW_YORK = 'America/New_York';

const base: ClassRule = {
  weekdays: [1],
  firstDate: '2027-07-05', // a Monday
  startTime: '09:00',
  endTime: '12:00',
  end: { kind: 'count', count: 3 },
};

const expanded = (rule: ClassRule, zone = SYDNEY) => {
  const r = expandClassRule(rule, zone);
  if (!r.ok) {
    throw new Error(`expected ok, got: ${r.message}`);
  }

  return r.occurrences;
};

const refusal = (rule: ClassRule, zone = SYDNEY): string => {
  const r = expandClassRule(rule, zone);
  if (r.ok) {
    throw new Error('expected a refusal');
  }

  return r.message;
};

describe('expandClassRule', () => {
  it('places a weekly class on each chosen weekday, in date order, with the camp zone offset', () => {
    const out = expanded(base);

    expect(out.map(o => o.date)).toEqual(['2027-07-05', '2027-07-12', '2027-07-19']);
    expect(out[0]).toEqual({
      date: '2027-07-05',
      startsAt: '2027-07-04T23:00:00.000Z', // 09:00 at UTC+10
      endsAt: '2027-07-05T02:00:00.000Z',
    });
  });

  it('combines several weekdays and keeps them in order within a week', () => {
    const out = expanded({ ...base, weekdays: [5, 1], end: { kind: 'count', count: 4 } });

    expect(out.map(o => o.date)).toEqual(['2027-07-05', '2027-07-09', '2027-07-12', '2027-07-16']);
  });

  it('counts classes, not weeks: a count of 1 is one class even when the first day is not chosen', () => {
    const out = expanded({ ...base, firstDate: '2027-07-06', weekdays: [1], end: { kind: 'count', count: 1 } });

    expect(out.map(o => o.date)).toEqual(['2027-07-12']);
  });

  it('stops at an until date and includes it when it is a chosen day', () => {
    const out = expanded({ ...base, end: { kind: 'until', date: '2027-07-19' } });

    expect(out.map(o => o.date)).toEqual(['2027-07-05', '2027-07-12', '2027-07-19']);
  });

  it('an until date between two occurrences ends the series before the next one', () => {
    const out = expanded({ ...base, end: { kind: 'until', date: '2027-07-18' } });

    expect(out.map(o => o.date)).toEqual(['2027-07-05', '2027-07-12']);
  });

  it('crosses a month end and a leap day without skipping or repeating a day', () => {
    const out = expanded({
      weekdays: [3], // Wednesday
      firstDate: '2028-02-23',
      startTime: '10:00',
      endTime: '11:00',
      end: { kind: 'count', count: 3 },
    });

    expect(out.map(o => o.date)).toEqual(['2028-02-23', '2028-03-01', '2028-03-08']);
  });

  it('a class whose end is at or before its start runs into the next day', () => {
    const out = expanded({ ...base, startTime: '22:00', endTime: '01:00', end: { kind: 'count', count: 1 } });

    expect(out[0].startsAt).toBe('2027-07-05T12:00:00.000Z');
    expect(out[0].endsAt).toBe('2027-07-05T15:00:00.000Z');
  });

  it('keeps the local clock time across a daylight-saving change (the UTC instant moves)', () => {
    // New York moves to daylight time on 2027-03-14: the wall clock stays at 09:00 and the UTC instant moves by an hour.
    const out = expanded(
      {
        weekdays: [7], // Sunday
        firstDate: '2027-03-07',
        startTime: '09:00',
        endTime: '10:00',
        end: { kind: 'count', count: 2 },
      },
      NEW_YORK,
    );

    expect(out.map(o => o.startsAt)).toEqual(['2027-03-07T14:00:00.000Z', '2027-03-14T13:00:00.000Z']);
  });

  it('a class on the day clocks go back keeps its local start', () => {
    const out = expanded(
      {
        weekdays: [7],
        firstDate: '2027-10-31',
        startTime: '09:00',
        endTime: '10:00',
        end: { kind: 'count', count: 2 },
      },
      NEW_YORK,
    );

    // 2027-10-31 is still on daylight time (UTC-4); the next Sunday is standard time (UTC-5).
    expect(out.map(o => o.startsAt)).toEqual(['2027-10-31T13:00:00.000Z', '2027-11-07T14:00:00.000Z']);
  });

  it('refuses a series with no weekday, an invalid weekday, or a bad date or clock time', () => {
    expect(refusal({ ...base, weekdays: [] })).toMatch(/at least one day/);
    expect(refusal({ ...base, weekdays: [0] })).toMatch(/at least one day/);
    expect(refusal({ ...base, weekdays: [8] })).toMatch(/at least one day/);
    expect(refusal({ ...base, firstDate: '2027-02-30' })).toMatch(/real first date/);
    expect(refusal({ ...base, startTime: '9am' })).toMatch(/24-hour/);
    expect(refusal({ ...base, endTime: '24:00' })).toMatch(/24-hour/);
  });

  it('refuses a class that starts and ends at the same time', () => {
    expect(refusal({ ...base, endTime: '09:00' })).toMatch(/must end after it starts/);
  });

  it('refuses an until date before the first date, and an until date more than two years away', () => {
    expect(refusal({ ...base, end: { kind: 'until', date: '2027-07-04' } })).toMatch(/cannot be before/);
    expect(refusal({ ...base, end: { kind: 'until', date: '2030-01-01' } })).toMatch(/two years/);
    expect(refusal({ ...base, end: { kind: 'until', date: '2027-02-31' } })).toMatch(/real end date/);
  });

  it('refuses a count out of range', () => {
    expect(refusal({ ...base, end: { kind: 'count', count: 0 } })).toMatch(/between 1 and/);
    expect(refusal({ ...base, end: { kind: 'count', count: MAX_RECURRING_CLASSES + 1 } })).toMatch(/between 1 and/);
    expect(refusal({ ...base, end: { kind: 'count', count: 2.5 } })).toMatch(/between 1 and/);
  });

  it('caps an until series at the maximum number of classes, with a message to shorten it', () => {
    // Daily from 2027-01-01 to 2028-09-30 is well over 100 days but within the two-year window: the cap, not the window, stops it.
    const message = refusal({
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      firstDate: '2027-01-01',
      startTime: '09:00',
      endTime: '10:00',
      end: { kind: 'until', date: '2027-12-31' },
    });

    expect(message).toMatch(/at most 100 classes/);
  });

  it('a count reaches the cap exactly and is not refused', () => {
    const out = expanded({
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      firstDate: '2027-01-01',
      startTime: '09:00',
      endTime: '10:00',
      end: { kind: 'count', count: MAX_RECURRING_CLASSES },
    });

    expect(out).toHaveLength(MAX_RECURRING_CLASSES);
  });

  it('a weekly count at the cap fits the two-year window (100 weeks is 700 days)', () => {
    const out = expanded({ ...base, weekdays: [1], end: { kind: 'count', count: MAX_RECURRING_CLASSES } });

    expect(out).toHaveLength(MAX_RECURRING_CLASSES);
    expect(out[out.length - 1].date).toBe('2029-05-28');
  });

  it('refuses a rule that places nothing (until a day that is never chosen)', () => {
    expect(refusal({ ...base, weekdays: [2], end: { kind: 'until', date: '2027-07-05' } })).toMatch(/No class falls/);
  });

  it('is pure: the same rule gives the same answer every time and the input is not changed', () => {
    const rule: ClassRule = { ...base, weekdays: [5, 1] };
    const snapshot = JSON.stringify(rule);

    expect(expanded(rule)).toEqual(expanded(rule));
    expect(JSON.stringify(rule)).toBe(snapshot);
  });
});
