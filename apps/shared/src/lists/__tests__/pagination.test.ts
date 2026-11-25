import { describe, expect, it } from 'vitest';
import { pageCount, pageOf } from '../pagination';

const twentyThree = Array.from({ length: 23 }, (_, index) => index + 1);

describe('pageCount', () => {
  it('rounds up to whole pages', () => {
    expect(pageCount(23, 10)).toBe(3);
    expect(pageCount(20, 10)).toBe(2);
  });

  it('counts an empty list as one page', () => {
    expect(pageCount(0, 10)).toBe(1);
  });

  it('rejects a page size that is not a whole number of 1 or more', () => {
    expect(() => pageCount(5, 0)).toThrow(RangeError);
    expect(() => pageCount(5, 2.5)).toThrow(RangeError);
  });
});

describe('pageOf', () => {
  it('returns the slice for the page, with its range and the page count', () => {
    const second = pageOf(twentyThree, 2, 10);

    expect(second.items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(second).toMatchObject({ page: 2, pageCount: 3, from: 11, to: 20, total: 23 });
  });

  it('returns the short last page with its own range', () => {
    const last = pageOf(twentyThree, 3, 10);

    expect(last.items).toEqual([21, 22, 23]);
    expect(last).toMatchObject({ page: 3, pageCount: 3, from: 21, to: 23 });
  });

  it('clamps a page past the end to the last page', () => {
    expect(pageOf(twentyThree, 9, 10).page).toBe(3);
  });

  it('clamps a page below 1 to the first page', () => {
    expect(pageOf(twentyThree, 0, 10).items[0]).toBe(1);
    expect(pageOf(twentyThree, -4, 10).page).toBe(1);
  });

  it('reads a page that is not a finite number as the first page', () => {
    expect(pageOf(twentyThree, Number.NaN, 10).page).toBe(1);
  });

  it('handles an empty list: no items, one page, and an empty range', () => {
    expect(pageOf([], 1, 10)).toEqual({ items: [], page: 1, pageCount: 1, from: 0, to: 0, total: 0 });
    expect(pageOf([], 4, 10).page).toBe(1);
  });
});
