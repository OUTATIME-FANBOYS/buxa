import { describe, expect, it } from 'vitest';
import { peoplePageHref, readListParams, readPage, toPageQuery } from '../listQuery';

describe('people list query', () => {
  it('reads q trimmed and capped at 80, and ignores an unknown role', () => {
    expect(readListParams({ q: '  Lee  ', role: 'nope' })).toEqual({ q: 'Lee', role: '', page: 1 });
    expect(readListParams({ q: 'a'.repeat(100) }).q).toHaveLength(80);
  });
  it('ignores repeated or missing parameters', () => {
    expect(readListParams({ q: ['a', 'b'], role: ['camper'], page: ['2'] })).toEqual({ q: '', role: '', page: 1 });
    expect(readListParams({})).toEqual({ q: '', role: '', page: 1 });
  });
  it('leaves absent values out of the service query, and sends the page', () => {
    expect(toPageQuery({ q: '', role: '', page: 1 })).toEqual({ page: 1 });
    expect(toPageQuery({ q: 'Lee', role: 'camper', page: 3 })).toEqual({ query: 'Lee', role: 'camper', page: 3 });
  });
});

describe('page number from the address', () => {
  it('reads a whole number of 1 or more', () => {
    expect(readPage('1')).toBe(1);
    expect(readPage('2')).toBe(2);
    expect(readPage('143')).toBe(143);
  });
  it('falls back to page 1 for anything that is not a whole number of 1 or more', () => {
    expect(readPage('0')).toBe(1);
    expect(readPage('-1')).toBe(1);
    expect(readPage('2.5')).toBe(1);
    expect(readPage('1e3')).toBe(1);
    expect(readPage('abc')).toBe(1);
    expect(readPage('')).toBe(1);
    expect(readPage(undefined)).toBe(1);
    expect(readPage(['2'])).toBe(1);
    expect(readPage('99999999999999999999')).toBe(1);
    expect(readPage(' 2')).toBe(1);
    expect(readPage('NaN')).toBe(1);
  });
});

describe('peoplePageHref', () => {
  it('keeps the search and role and writes the page first', () => {
    expect(peoplePageHref({ q: 'Lee', role: 'camper', page: 1 }, 2)).toBe('/camp/people?page=2&q=Lee&role=camper');
  });
  it('leaves page 1 out, so the first page has the plain address', () => {
    expect(peoplePageHref({ q: '', role: '', page: 3 }, 1)).toBe('/camp/people');
    expect(peoplePageHref({ q: 'Lee', role: '', page: 3 }, 1)).toBe('/camp/people?q=Lee');
  });
  it('encodes the search text', () => {
    expect(peoplePageHref({ q: 'Ann Lee', role: '', page: 1 }, 2)).toBe('/camp/people?page=2&q=Ann+Lee');
  });
});
