import { describe, expect, it } from 'vitest';
import {
  activeSpans,
  cancelReasonOf,
  decideCancel,
  decideRestore,
  findSeriesClash,
  MAX_CANCEL_REASON_LENGTH,
  MONDAY_TO_FRIDAY,
  normaliseWeekdays,
  occurrenceRefusalMessage,
  planSeries,
} from './series';

const ms = (iso: string): number => Date.parse(iso);

describe('normaliseWeekdays', () => {
  it('sorts and de-duplicates the chosen days', () => {
    expect(normaliseWeekdays([5, 1, 5, 3])).toEqual({ ok: true, weekdays: [1, 3, 5] });
  });

  it('refuses an empty set, which is the rule: at least one day', () => {
    expect(normaliseWeekdays([])).toEqual({ ok: false, message: 'Choose at least one day of the week.' });
  });

  it('refuses a day outside Monday (1) to Sunday (7)', () => {
    expect(normaliseWeekdays([0, 2]).ok).toBe(false);
    expect(normaliseWeekdays([8]).ok).toBe(false);
    expect(normaliseWeekdays([2.5]).ok).toBe(false);
  });

  it('defaults to Monday to Friday', () => {
    expect(MONDAY_TO_FRIDAY).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('planSeries', () => {
  it('expands Monday to Friday over three weeks into 15 occurrences, each at the start and end clock times', () => {
    const plan = planSeries(
      { weekdays: MONDAY_TO_FRIDAY, startsLocal: '2027-04-05T09:00', endsLocal: '2027-04-23T12:00' },
      'UTC',
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }
    expect(plan.series.occurrences).toHaveLength(15);
    expect(plan.series.weekdays).toEqual([1, 2, 3, 4, 5]);
    expect(ms(plan.series.occurrences[0].startsAt)).toBe(Date.UTC(2027, 3, 5, 9));
    expect(ms(plan.series.occurrences[0].endsAt)).toBe(Date.UTC(2027, 3, 5, 12));
    expect(ms(plan.series.seriesStartsAt)).toBe(Date.UTC(2027, 3, 5, 9));
    expect(ms(plan.series.seriesEndsAt)).toBe(Date.UTC(2027, 3, 23, 12));
  });

  it('keeps the camp clock across the time zone: 09:00 in Sydney is the previous evening in UTC', () => {
    const plan = planSeries(
      { weekdays: [1], startsLocal: '2027-04-05T09:00', endsLocal: '2027-04-05T12:00' },
      'Australia/Sydney',
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }
    expect(ms(plan.series.occurrences[0].startsAt)).toBe(Date.UTC(2027, 3, 4, 23));
  });

  it('gives one occurrence per chosen weekday, Sunday included', () => {
    const plan = planSeries({ weekdays: [7], startsLocal: '2027-04-05T09:00', endsLocal: '2027-04-18T10:00' }, 'UTC');
    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }
    expect(plan.series.occurrences.map(o => o.date)).toEqual(['2027-04-11', '2027-04-18']);
  });

  it('refuses a series with no day, a series that ends before it starts, and a series that ends when it starts', () => {
    expect(planSeries({ weekdays: [], startsLocal: '2027-04-05T09:00', endsLocal: '2027-04-09T12:00' }, 'UTC')).toEqual(
      {
        ok: false,
        message: 'Choose at least one day of the week.',
      },
    );
    const reversed = planSeries(
      { weekdays: [1], startsLocal: '2027-04-09T09:00', endsLocal: '2027-04-05T12:00' },
      'UTC',
    );
    expect(reversed).toEqual({ ok: false, message: 'The series must end after it starts.' });
    const same = planSeries({ weekdays: [1], startsLocal: '2027-04-05T09:00', endsLocal: '2027-04-05T09:00' }, 'UTC');
    expect(same.ok).toBe(false);
  });

  it('refuses a series that has no day of the chosen weekdays in its range', () => {
    const plan = planSeries({ weekdays: [6], startsLocal: '2027-04-05T09:00', endsLocal: '2027-04-06T12:00' }, 'UTC');
    expect(plan.ok).toBe(false);
  });
});

describe('cancelling and restoring one day', () => {
  it('cancels an active day, and refuses a second cancel', () => {
    expect(decideCancel({ status: 'active' })).toEqual({ kind: 'cancel' });
    expect(decideCancel({ status: 'cancelled' })).toEqual({ kind: 'refuse', reason: 'already_cancelled' });
  });

  it('restores a cancelled day, and refuses to restore one that is not cancelled', () => {
    expect(decideRestore({ status: 'cancelled' })).toEqual({ kind: 'restore' });
    expect(decideRestore({ status: 'active' })).toEqual({ kind: 'refuse', reason: 'not_cancelled' });
  });

  it('needs a reason: blank is refused, and the text is trimmed', () => {
    expect(cancelReasonOf('   ')).toEqual({
      ok: false,
      message: 'Say why this day is cancelled, for example "Public holiday".',
    });
    expect(cancelReasonOf('  Public holiday  ')).toEqual({ ok: true, reason: 'Public holiday' });
  });

  it('caps the reason at the length the database stores', () => {
    expect(cancelReasonOf('x'.repeat(MAX_CANCEL_REASON_LENGTH)).ok).toBe(true);
    expect(cancelReasonOf('x'.repeat(MAX_CANCEL_REASON_LENGTH + 1)).ok).toBe(false);
  });

  it('has the refusal copy the screen shows', () => {
    expect(occurrenceRefusalMessage('already_cancelled')).toBe('This day is already cancelled.');
    expect(occurrenceRefusalMessage('not_cancelled')).toContain('not cancelled');
  });

  it('a cancelled day takes no part in overlap checks', () => {
    const days = [
      { startsAt: '2027-04-05T09:00:00Z', endsAt: '2027-04-05T12:00:00Z', status: 'cancelled' as const },
      { startsAt: '2027-04-06T09:00:00Z', endsAt: '2027-04-06T12:00:00Z', status: 'active' as const },
    ];
    expect(activeSpans(days)).toEqual([{ startsAt: '2027-04-06T09:00:00Z', endsAt: '2027-04-06T12:00:00Z' }]);
  });
});

describe('overlap across series', () => {
  const artCamp = {
    seriesId: 'art',
    spans: [{ startsAt: '2027-04-05T09:00:00Z', endsAt: '2027-04-05T12:00:00Z' }],
  };

  it('refuses a series whose active day overlaps a day of another series the child is in', () => {
    const candidate = [{ startsAt: '2027-04-05T10:30:00Z', endsAt: '2027-04-05T11:30:00Z' }];
    const clash = findSeriesClash(candidate, [artCamp]);
    expect(clash?.seriesId).toBe('art');
    expect(clash?.other.startsAt).toBe('2027-04-05T09:00:00Z');
  });

  it('lets a day that only touches another series through (12:00 end, 12:00 start)', () => {
    const candidate = [{ startsAt: '2027-04-05T12:00:00Z', endsAt: '2027-04-05T13:00:00Z' }];
    expect(findSeriesClash(candidate, [artCamp])).toBeNull();
  });

  it('reports the earliest clash, so the same clash is named every time', () => {
    const candidate = [
      { startsAt: '2027-04-06T10:00:00Z', endsAt: '2027-04-06T11:00:00Z' },
      { startsAt: '2027-04-05T10:00:00Z', endsAt: '2027-04-05T11:00:00Z' },
    ];
    const other = {
      seriesId: 'pottery',
      spans: [
        { startsAt: '2027-04-06T10:30:00Z', endsAt: '2027-04-06T11:30:00Z' },
        { startsAt: '2027-04-05T10:30:00Z', endsAt: '2027-04-05T11:30:00Z' },
      ],
    };
    const clash = findSeriesClash(candidate, [other]);
    expect(clash?.candidate.startsAt).toBe('2027-04-05T10:00:00Z');
  });

  it('finds no clash when the child is in no other series', () => {
    expect(findSeriesClash([{ startsAt: '2027-04-05T10:00:00Z', endsAt: '2027-04-05T11:00:00Z' }], [])).toBeNull();
  });
});
