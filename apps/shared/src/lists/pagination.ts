/** One page of a list, with the 1-based range it shows for a status line such as "Showing 11-20 of 23". */
export interface ListPage<T> {
  items: readonly T[];
  /** The page shown, clamped into 1..pageCount. */
  page: number;
  pageCount: number;
  /** The 1-based position of the first item shown; 0 when the list is empty. */
  from: number;
  /** The 1-based position of the last item shown; 0 when the list is empty. */
  to: number;
  total: number;
}

/** The page size used when a caller does not choose one. */
export const DEFAULT_PAGE_SIZE = 10;

function checkedPageSize(pageSize: number): number {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError(`A page size must be a whole number of 1 or more, got ${pageSize}`);
  }

  return pageSize;
}

/** How many pages a list of `total` items fills. An empty list still has one (empty) page, so a caller can test `pageCount > 1`. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / checkedPageSize(pageSize)));
}

/**
 * The slice of `items` for `page` (1-based). A page below 1 or past the last page is clamped to the nearest real page, so a list
 * that shrinks (after a search) never shows an empty page. A page that is not a finite number is read as page 1.
 */
export function pageOf<T>(items: readonly T[], page: number, pageSize: number): ListPage<T> {
  const size = checkedPageSize(pageSize);
  const count = pageCount(items.length, size);
  const requested = Number.isFinite(page) ? Math.floor(page) : 1;
  const current = Math.min(Math.max(1, requested), count);
  const start = (current - 1) * size;
  const slice = items.slice(start, start + size);

  return {
    items: slice,
    page: current,
    pageCount: count,
    from: slice.length === 0 ? 0 : start + 1,
    to: start + slice.length,
    total: items.length,
  };
}
