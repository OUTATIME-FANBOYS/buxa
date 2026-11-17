import { describe, expect, it } from 'vitest';
import { ScanInputSchema, SearchInputSchema } from '../inputs';

describe('attendance inputs', () => {
  it('ScanInputSchema accepts any code up to 500 characters and rejects longer ones', () => {
    expect(ScanInputSchema.safeParse({ raw: 'x'.repeat(500) }).success).toBe(true);
    expect(ScanInputSchema.safeParse({ raw: 'x'.repeat(501) }).success).toBe(false);
  });
  it('SearchInputSchema trims the query, allows empty and caps it at 80', () => {
    expect(SearchInputSchema.parse({ query: '  Ada  ' }).query).toBe('Ada');
    expect(SearchInputSchema.safeParse({ query: '' }).success).toBe(true);
    expect(SearchInputSchema.safeParse({ query: 'a'.repeat(81) }).success).toBe(false);
  });
});
