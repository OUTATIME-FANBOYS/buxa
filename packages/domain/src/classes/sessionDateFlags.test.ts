import { describe, expect, it } from 'vitest';
import {
  CLASS_DATES_FLAGGED_MESSAGE,
  classDatesRefusal,
  planSessionDates,
  sessionDatesBlockedMessage,
  sessionPublishBlockedMessage,
  type DatesPlanClass,
} from './sessionDateFlags';

const TZ = 'Australia/Sydney';
const JULY = { startsOn: '2027-07-01', endsOn: '2027-07-31' } as const;
const SHRUNK = { startsOn: '2027-07-01', endsOn: '2027-07-10' } as const;

/** A class on one day in July 2027, camp time (UTC+10). */
const onDay = (day: number, extra: Partial<DatesPlanClass> = {}): DatesPlanClass => ({
  id: `class-${day}`,
  name: `Class on ${day}`,
  startsAt: `2027-07-${String(day).padStart(2, '0')}T09:00:00+10:00`,
  endsAt: `2027-07-${String(day).padStart(2, '0')}T12:00:00+10:00`,
  datesOutsideSession: false,
  hasPeople: false,
  ...extra,
});

describe('classDatesRefusal (the one check for a flagged class)', () => {
  it('allows a class whose dates are inside its session', () => {
    expect(classDatesRefusal(false)).toBeNull();
  });

  it('refuses a flagged class with the owner-approved message', () => {
    expect(classDatesRefusal(true)).toBe(CLASS_DATES_FLAGGED_MESSAGE);
    expect(CLASS_DATES_FLAGGED_MESSAGE).toBe("This class falls outside its session's dates. Fix its dates first.");
  });
});

describe('planSessionDates', () => {
  it('flags exactly the classes that fall outside the new dates, and keeps the rest unflagged', () => {
    const plan = planSessionDates([onDay(3), onDay(9), onDay(15), onDay(20)], SHRUNK, TZ);
    expect(plan.newlyFlagged.map(c => c.id)).toEqual(['class-15', 'class-20']);
    expect(plan.outside.map(c => c.id)).toEqual(['class-15', 'class-20']);
    expect(plan.blocked).toEqual([]);
    expect(plan.cleared).toEqual([]);
  });

  it('a widening flags nothing', () => {
    const plan = planSessionDates([onDay(3), onDay(20)], { startsOn: '2027-06-01', endsOn: '2027-08-31' }, TZ);
    expect(plan.outside).toEqual([]);
    expect(plan.newlyFlagged).toEqual([]);
  });

  it('a class that already carries the flag and is still outside is not newly flagged', () => {
    const plan = planSessionDates([onDay(15, { datesOutsideSession: true })], SHRUNK, TZ);
    expect(plan.outside.map(c => c.id)).toEqual(['class-15']);
    expect(plan.newlyFlagged).toEqual([]);
  });

  it('clears the flag of a flagged class that the new dates cover again', () => {
    const plan = planSessionDates([onDay(3, { datesOutsideSession: true })], JULY, TZ);
    expect(plan.cleared).toEqual(['class-3']);
    expect(plan.outside).toEqual([]);
  });

  it('refuses a shrink when an affected class has people on it, and reports those classes', () => {
    const plan = planSessionDates(
      [onDay(3), onDay(15, { hasPeople: true, name: 'Swim Stars' }), onDay(20)],
      SHRUNK,
      TZ,
    );
    expect(plan.blocked.map(c => c.name)).toEqual(['Swim Stars']);
  });

  it('judges a class by the camp zone: a class that starts late on the last day is outside', () => {
    const lateOnLastDay = onDay(10, {
      startsAt: '2027-07-10T23:00:00+10:00',
      endsAt: '2027-07-11T01:00:00+10:00',
    });
    const plan = planSessionDates([lateOnLastDay], SHRUNK, TZ);
    expect(plan.outside.map(c => c.id)).toEqual(['class-10']);
  });
});

describe('sessionDatesBlockedMessage and sessionPublishBlockedMessage', () => {
  it('names one class in the singular', () => {
    expect(sessionDatesBlockedMessage(['Swim Stars'])).toBe(
      'Swim Stars would fall outside the new dates, and it has people on it. Move or cancel it first, then change the session dates.',
    );
  });

  it('names several classes in a list', () => {
    expect(sessionDatesBlockedMessage(['Swim Stars', 'Art'])).toBe(
      '2 classes would fall outside the new dates and have people on them: Swim Stars, Art. Move or cancel them first, then change the session dates.',
    );
  });

  it('says a session cannot go live while any class is flagged', () => {
    expect(sessionPublishBlockedMessage(['Swim Stars'])).toBe(
      'This session cannot go live: Swim Stars has dates outside the session. Fix its dates first.',
    );
    expect(sessionPublishBlockedMessage(['Swim Stars', 'Art'])).toBe(
      'This session cannot go live: 2 classes have dates outside the session (Swim Stars, Art). Fix their dates first.',
    );
  });
});
