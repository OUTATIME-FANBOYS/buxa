import { describe, expect, it } from 'vitest';
import { fixClassesLabel, flaggedClassesSummary } from './sessionDatesPreview';

describe('the Edit session confirmation copy', () => {
  it('names one flagged class in the singular', () => {
    expect(flaggedClassesSummary(['Swim Stars'])).toBe('1 class falls outside the new dates: Swim Stars.');
  });

  it('lists several flagged classes by name', () => {
    expect(flaggedClassesSummary(['Swim Stars', 'Art', 'Sailing'])).toBe(
      '3 classes fall outside the new dates: Swim Stars, Art, Sailing.',
    );
  });

  it('labels the toast action for the Classes tab', () => {
    expect(fixClassesLabel(1)).toBe('Fix 1 class');
    expect(fixClassesLabel(3)).toBe('Fix 3 classes');
  });
});
