import { describe, expect, it } from 'vitest';
import { displayName, formatLocalDate } from '../format';

describe('people format', () => {
  it('formats a camp day as an English date without shifting it by time zone', () => {
    expect(formatLocalDate('2027-07-03')).toBe('3 Jul 2027');
  });
  it('never uses a preferred name: the display name is first name, then family name', () => {
    expect(displayName({ givenName: 'Anna', familyName: 'Lee' })).toBe('Anna Lee');
    // Built outside an object literal, so an extra field is not a type error: a stray value must still be ignored.
    const withStaleField = { givenName: 'Anna', familyName: 'Lee', preferredName: 'Annie' };
    expect(displayName(withStaleField)).toBe('Anna Lee');
  });
});
