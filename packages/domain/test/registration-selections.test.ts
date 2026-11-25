import { describe, expect, it } from 'vitest';
import { decideSelections, type ClassSelection } from '../src/registration/rules';

const ADA = 'ada-1';
const BEN = 'ben-2';

/** A one-day class: its own series, with its anchor as the only day. */
const sel = (camperId: string, classId: string, startsAt: string, endsAt: string): ClassSelection => ({
  camperId,
  classId,
  className: classId,
  seriesId: classId,
  startsAt,
  endsAt,
  occurrences: [{ startsAt, endsAt }],
});

/** A series of days: the anchor is its first day, and `occurrences` lists every active day. */
const series = (camperId: string, seriesId: string, days: readonly (readonly [string, string])[]): ClassSelection => ({
  camperId,
  classId: `${seriesId}-anchor`,
  className: seriesId,
  seriesId,
  startsAt: days[0][0],
  endsAt: days[0][1],
  occurrences: days.map(([startsAt, endsAt]) => ({ startsAt, endsAt })),
});

const MORNING = ['2027-07-10T10:00:00.000Z', '2027-07-10T11:00:00.000Z'] as const;
const LATE_MORNING = ['2027-07-10T10:30:00.000Z', '2027-07-10T11:30:00.000Z'] as const;
const AFTERNOON = ['2027-07-10T13:00:00.000Z', '2027-07-10T14:00:00.000Z'] as const;
const TOUCHING = ['2027-07-10T11:00:00.000Z', '2027-07-10T12:00:00.000Z'] as const;

describe('decideSelections: a child may take several classes when their times do not overlap', () => {
  it('allows two classes of one child that do not overlap', () => {
    expect(decideSelections([sel(ADA, 'archery', ...MORNING), sel(ADA, 'painting', ...AFTERNOON)])).toEqual({
      allow: true,
    });
  });

  it('allows classes that only touch (one ends as the next starts)', () => {
    expect(decideSelections([sel(ADA, 'archery', ...MORNING), sel(ADA, 'swim', ...TOUCHING)])).toEqual({ allow: true });
  });

  it('refuses two classes of one child that overlap, and names the pair', () => {
    const decision = decideSelections([sel(ADA, 'archery', ...MORNING), sel(ADA, 'swim', ...LATE_MORNING)]);
    expect(decision).toMatchObject({ allow: false, reason: 'classes_overlap' });
    if (!decision.allow && decision.reason === 'classes_overlap') {
      expect([decision.first.classId, decision.second.classId]).toEqual(['archery', 'swim']);
    }
  });

  it('checks every pair, not only neighbours in the list', () => {
    const decision = decideSelections([
      sel(ADA, 'long', '2027-07-10T09:00:00.000Z', '2027-07-10T15:00:00.000Z'),
      sel(ADA, 'afternoon', ...AFTERNOON),
    ]);
    expect(decision).toMatchObject({ allow: false, reason: 'classes_overlap' });
  });

  it('lets two different children take overlapping classes', () => {
    expect(decideSelections([sel(ADA, 'archery', ...MORNING), sel(BEN, 'swim', ...LATE_MORNING)])).toEqual({
      allow: true,
    });
  });

  it('refuses the same class twice for one child', () => {
    expect(decideSelections([sel(ADA, 'archery', ...MORNING), sel(ADA, 'archery', ...MORNING)])).toMatchObject({
      allow: false,
      reason: 'duplicate_selection',
    });
  });

  it('refuses an empty selection', () => {
    expect(decideSelections([])).toEqual({ allow: false, reason: 'no_classes' });
  });
});

describe('decideSelections: a child takes one place per series', () => {
  const MON = ['2027-07-05T10:00:00.000Z', '2027-07-05T11:00:00.000Z'] as const;
  const TUE = ['2027-07-06T10:00:00.000Z', '2027-07-06T11:00:00.000Z'] as const;
  const WED = ['2027-07-07T10:00:00.000Z', '2027-07-07T11:00:00.000Z'] as const;
  const WED_LATE = ['2027-07-07T10:30:00.000Z', '2027-07-07T12:00:00.000Z'] as const;

  it('refuses one series twice for one child, even when the two selections name different days', () => {
    const decision = decideSelections([series(ADA, 'art', [MON, TUE]), series(ADA, 'art', [MON, TUE])]);
    expect(decision).toMatchObject({ allow: false, reason: 'duplicate_selection' });
  });

  it('lets two children take the same series', () => {
    expect(decideSelections([series(ADA, 'art', [MON, TUE]), series(BEN, 'art', [MON, TUE])])).toEqual({ allow: true });
  });

  it('refuses two series that overlap on a day after their anchors, even though the anchors do not clash', () => {
    // Art is on Monday and Wednesday, Swim on Tuesday and Wednesday from 10:30: the Wednesdays overlap.
    const decision = decideSelections([series(ADA, 'art', [MON, WED]), series(ADA, 'swim', [TUE, WED_LATE])]);
    expect(decision).toMatchObject({ allow: false, reason: 'classes_overlap' });
  });

  it('allows two series whose days never overlap', () => {
    expect(decideSelections([series(ADA, 'art', [MON, WED]), series(ADA, 'swim', [TUE])])).toEqual({ allow: true });
  });
});
