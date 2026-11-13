import { describe, expect, it } from 'vitest';
import { isCampHash, isEmptyHash, parseCampHash } from './routing';

describe('routing', () => {
  it('the bare address and #/camp are the camp area; legacy kanban routes are not', () => {
    for (const h of ['', '#', '#/', '#/camp', '#/camp/members']) expect(isCampHash(h)).toBe(true);
    for (const h of ['#/dashboard', '#/board/p1', '#/campaign', '#/settings']) expect(isCampHash(h)).toBe(false);
  });
  it('only the bare address is "empty" (it redirects to the camp home)', () => {
    for (const h of ['', '#', '#/']) expect(isEmptyHash(h)).toBe(true);
    for (const h of ['#/camp', '#/dashboard']) expect(isEmptyHash(h)).toBe(false);
  });
  it('parses camp routes', () => {
    expect(parseCampHash('#/camp')).toEqual({ name: 'overview' });
    expect(parseCampHash('')).toEqual({ name: 'overview' });
    expect(parseCampHash('#/camp/members')).toEqual({ name: 'members' });
    expect(parseCampHash('#/camp/new')).toEqual({ name: 'new' });
    expect(parseCampHash('#/camp/nope')).toMatchObject({ name: 'notfound' });
    expect(parseCampHash('#/camp/members/extra')).toMatchObject({ name: 'notfound' });
    expect(parseCampHash('#/camp/members?x=1')).toEqual({ name: 'members' });
  });
});
