import { describe, expect, it } from 'vitest';
import { displayName, formatLocalDate } from '../format';

describe('people format', () => {
  it('formats a camp day as an English date without shifting it by time zone', () => {
    expect(formatLocalDate('2027-07-03')).toBe('3 Jul 2027');
  });
  it('shows the preferred name in brackets between given and family names', () => {
    expect(displayName({ givenName: 'Anna', familyName: 'Lee', preferredName: 'Annie' })).toBe('Anna (Annie) Lee');
    expect(displayName({ givenName: 'Anna', familyName: 'Lee', preferredName: null })).toBe('Anna Lee');
  });
});
