import { describe, expect, it } from 'vitest';
import { PEOPLE_PAGE_SIZE, PEOPLE_PAGE_SIZE_MAX, clampPageSize, pageSpan } from '../paging';

describe('pageSpan', () => {
  it('uses 25 rows by default and works out the offset and the shown range', () => {
    expect(pageSpan(143, 2)).toEqual({ page: 2, pageSize: 25, pageCount: 6, offset: 25, limit: 25, from: 26, to: 50 });
    expect(pageSpan(143, 6)).toEqual({
      page: 6,
      pageSize: 25,
      pageCount: 6,
      offset: 125,
      limit: 25,
      from: 126,
      to: 143,
    });
  });

  it('holds a page past the end at the last page', () => {
    expect(pageSpan(143, 99)).toMatchObject({ page: 6, offset: 125, from: 126, to: 143 });
  });

  it('falls back to page 1 for a page below 1 or not a number', () => {
    expect(pageSpan(50, 0).page).toBe(1);
    expect(pageSpan(50, -4).page).toBe(1);
    expect(pageSpan(50, Number.NaN).page).toBe(1);
    expect(pageSpan(50, Number.POSITIVE_INFINITY).page).toBe(1);
  });

  it('floors a fractional page', () => {
    expect(pageSpan(100, 2.9).page).toBe(2);
  });

  it('caps the page size at 100 and never goes below 1', () => {
    expect(PEOPLE_PAGE_SIZE_MAX).toBe(100);
    expect(pageSpan(500, 1, 1000)).toMatchObject({ pageSize: 100, pageCount: 5, limit: 100, to: 100 });
    expect(pageSpan(500, 1, 0)).toMatchObject({ pageSize: 1, pageCount: 500 });
  });

  it('shows one empty page when nothing matches', () => {
    expect(pageSpan(0, 1)).toEqual({ page: 1, pageSize: 25, pageCount: 1, offset: 0, limit: 25, from: 0, to: 0 });
    expect(pageSpan(0, 3).page).toBe(1);
  });

  it('counts whole pages: exactly 25 people is one page, 26 is two', () => {
    expect(pageSpan(25, 1)).toMatchObject({ pageCount: 1, from: 1, to: 25 });
    expect(pageSpan(26, 2)).toMatchObject({ pageCount: 2, from: 26, to: 26 });
  });
});

describe('clampPageSize', () => {
  it('uses the default when no size is given', () => {
    expect(clampPageSize(undefined)).toBe(PEOPLE_PAGE_SIZE);
    expect(clampPageSize(Number.NaN)).toBe(PEOPLE_PAGE_SIZE);
  });
});
