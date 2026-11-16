import { describe, expect, it } from 'vitest';
import { describeReset } from './resetText';

describe('describeReset', () => {
  const text = describeReset({ people: 40, households: 12, memberships: 30, badges: 44, checkIns: 6 });

  it('lists every row kind that will be deleted, with its count', () => {
    expect(text).toContain('DELETE');
    expect(text).toContain('Camp Birchwood');
    expect(text).toContain('40 people');
    expect(text).toContain('12 households');
    expect(text).toContain('30 memberships');
    expect(text).toContain('44 badges');
    expect(text).toContain('6 check-ins');
  });

  it('says what is kept', () => {
    expect(text).toMatch(/Kept: the camp itself, its members and the audit log/);
  });
});
