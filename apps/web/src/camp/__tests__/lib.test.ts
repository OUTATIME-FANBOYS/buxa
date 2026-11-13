import { describe, expect, it } from 'vitest';
import { SLUG_RULE, abilitiesFor, isCampHash, parseCampHash, suggestSlug } from '../lib';

describe('suggestSlug', () => {
  it.each([
    ['Sunrise Lake Camp', 'sunrise-lake-camp'], ['  Café  Étoile!! ', 'cafe-etoile'], ['A&B -- Camp', 'a-b-camp'],
    ['--x--', ''], ['ab', ''], ['', ''], ['Camp 2026', 'camp-2026'],
  ])('%j → %j', (input, out) => expect(suggestSlug(input)).toBe(out));
  it('always satisfies the database rule when it returns something', () => {
    for (const n of ['Lake Camp', 'x'.repeat(80), 'Ça va? Oui!', '123 456', 'a b c d e f']) { const s = suggestSlug(n); if (s) expect(s).toMatch(SLUG_RULE); }
  });
  it('is capped at 50 characters and never ends with a dash', () => {
    const s = suggestSlug('word '.repeat(30)); expect(s.length).toBeLessThanOrEqual(50); expect(s.endsWith('-')).toBe(false);
  });
});

describe('routing', () => {
  it('empty and #/camp are the camp area; legacy kanban routes are not', () => {
    for (const h of ['', '#', '#/', '#/camp', '#/camp/members']) expect(isCampHash(h)).toBe(true);
    for (const h of ['#/dashboard', '#/board/p1', '#/campaign', '#/settings']) expect(isCampHash(h)).toBe(false);
  });
  it('parses camp routes', () => {
    expect(parseCampHash('#/camp')).toEqual({ name: 'overview' });
    expect(parseCampHash('')).toEqual({ name: 'overview' });
    expect(parseCampHash('#/camp/members')).toEqual({ name: 'members' });
    expect(parseCampHash('#/camp/new')).toEqual({ name: 'new' });
    expect(parseCampHash('#/camp/nope')).toMatchObject({ name: 'notfound' });
    expect(parseCampHash('#/camp/members/extra')).toMatchObject({ name: 'notfound' });
  });
});

describe('abilitiesFor (shared with the server rules)', () => {
  const allowed = (r: Parameters<typeof abilitiesFor>[0]) => abilitiesFor(r).filter(a => a.allowed).map(a => a.label);
  it('viewer only looks', () => expect(allowed('viewer')).toEqual(['See who is in the camp']));
  it('staff can work but not administer', () => {
    expect(allowed('staff')).toContain('Record attendance'); expect(allowed('staff')).not.toContain('Rename the camp');
  });
  it('admin can rename and manage access but not delete', () => {
    expect(allowed('admin')).toEqual(expect.arrayContaining(['Rename the camp', 'Manage who has access', 'Read the audit log']));
    expect(allowed('admin')).not.toContain('Delete the camp');
  });
  it('owner can do everything listed', () => expect(abilitiesFor('owner').every(a => a.allowed)).toBe(true));
});
