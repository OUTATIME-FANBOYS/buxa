import { describe, expect, it } from 'vitest';
import { readListParams, toListQuery } from '../listQuery';

describe('people list query', () => {
  it('reads q trimmed and capped at 80, and ignores an unknown role', () => {
    expect(readListParams({ q: '  Lee  ', role: 'nope' })).toEqual({ q: 'Lee', role: '' });
    expect(readListParams({ q: 'a'.repeat(100) }).q).toHaveLength(80);
  });
  it('ignores repeated or missing parameters', () => {
    expect(readListParams({ q: ['a', 'b'], role: ['camper'] })).toEqual({ q: '', role: '' });
    expect(readListParams({})).toEqual({ q: '', role: '' });
  });
  it('leaves absent values out of the service query', () => {
    expect(toListQuery({ q: '', role: '' })).toEqual({});
    expect(toListQuery({ q: 'Lee', role: '' })).toEqual({ query: 'Lee' });
  });
});
