import { describe, expect, it } from 'vitest';
import { datesError, DUE_BEFORE_START, titleError, TITLE_REQUIRED, TITLE_TOO_LONG } from '../taskValidation';

describe('task validation', () => {
  it('requires a title and caps its length', () => {
    expect(titleError('  ')).toBe(TITLE_REQUIRED);
    expect(titleError('x'.repeat(141))).toBe(TITLE_TOO_LONG);
    expect(titleError('x'.repeat(140))).toBeUndefined();
  });
  it('rejects a due date before the start date only when both are set', () => {
    expect(datesError('2026-02-02', '2026-02-01')).toBe(DUE_BEFORE_START);
    expect(datesError('2026-02-01', '2026-02-01')).toBeUndefined();
    expect(datesError('', '2026-02-01')).toBeUndefined();
    expect(datesError('2026-02-01', '')).toBeUndefined();
  });
});
