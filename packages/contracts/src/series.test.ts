import { describe, expect, it } from 'vitest';
import { CancelOccurrenceInputSchema, RestoreOccurrenceInputSchema, SeriesWeekdaysSchema } from './classes';

const OCCURRENCE = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('SeriesWeekdaysSchema', () => {
  it('accepts one to seven distinct days from Monday (1) to Sunday (7)', () => {
    expect(SeriesWeekdaysSchema.safeParse([1, 2, 3, 4, 5]).success).toBe(true);
    expect(SeriesWeekdaysSchema.safeParse([7]).success).toBe(true);
  });

  it('refuses no day, which is the rule: at least one', () => {
    const result = SeriesWeekdaysSchema.safeParse([]);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Choose at least one day of the week.');
  });

  it('refuses a day repeated, and a day outside the week', () => {
    expect(SeriesWeekdaysSchema.safeParse([1, 1]).success).toBe(false);
    expect(SeriesWeekdaysSchema.safeParse([0]).success).toBe(false);
    expect(SeriesWeekdaysSchema.safeParse([8]).success).toBe(false);
  });
});

describe('cancel and restore an occurrence', () => {
  it('needs an occurrence and a reason, and trims the reason', () => {
    const parsed = CancelOccurrenceInputSchema.parse({ occurrenceId: OCCURRENCE, reason: '  Public holiday ' });
    expect(parsed.reason).toBe('Public holiday');
    expect(CancelOccurrenceInputSchema.safeParse({ occurrenceId: OCCURRENCE, reason: '   ' }).success).toBe(false);
    expect(CancelOccurrenceInputSchema.safeParse({ occurrenceId: 'not-an-id', reason: 'Holiday' }).success).toBe(false);
  });

  it('caps the reason at 500 characters', () => {
    expect(CancelOccurrenceInputSchema.safeParse({ occurrenceId: OCCURRENCE, reason: 'x'.repeat(501) }).success).toBe(
      false,
    );
  });

  it('restore needs only the occurrence', () => {
    expect(RestoreOccurrenceInputSchema.safeParse({ occurrenceId: OCCURRENCE }).success).toBe(true);
    expect(RestoreOccurrenceInputSchema.safeParse({}).success).toBe(false);
  });
});
