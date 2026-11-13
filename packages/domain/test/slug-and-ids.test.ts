import { describe, expect, it } from 'vitest';
import { SLUG_PATTERN, isSlug, isUuid, suggestSlug } from '../src';

describe('suggestSlug', () => {
  it.each([
    ['Sunrise Lake Camp', 'sunrise-lake-camp'], ['  Café  Étoile!! ', 'cafe-etoile'], ['A&B -- Camp', 'a-b-camp'],
    ['--x--', ''], ['ab', ''], ['', ''], ['Camp 2026', 'camp-2026'],
  ])('%j → %j', (input, expected) => expect(suggestSlug(input)).toBe(expected));

  it('only ever returns something that passes the address rule', () => {
    for (const name of ['Lake Camp', 'x'.repeat(80), 'Ça va? Oui!', '123 456', 'a b c d e f']) {
      const slug = suggestSlug(name);
      if (slug) expect(slug).toMatch(SLUG_PATTERN);
    }
  });
  it('is capped at 50 characters and never ends with a dash', () => {
    const slug = suggestSlug('word '.repeat(30));
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('isSlug', () => {
  it('accepts valid addresses', () => { for (const s of ['abc', 'a-b', 'camp-2026', 'a1b']) expect(isSlug(s)).toBe(true); });
  it('rejects invalid ones', () => { for (const s of ['ab', '-ab', 'ab-', 'A-bc', 'a b c', 'a_b', '', 'x'.repeat(51)]) expect(isSlug(s)).toBe(false); });
});

describe('isUuid', () => {
  it('accepts canonical UUIDs in either case', () => {
    expect(isUuid('11111111-1111-1111-1111-111111111111')).toBe(true);
    expect(isUuid('ABCDEF12-3456-7890-ABCD-EF1234567890')).toBe(true);
  });
  it('rejects everything else, including non-strings and injection attempts', () => {
    for (const v of ['', 'not-a-uuid', "'; drop table orgs;--", '1111111111111111111111111111111111', 42, null, undefined, {}]) expect(isUuid(v)).toBe(false);
  });
});
