/** Rows on one page of the People list when the address does not say otherwise. */
export const PEOPLE_PAGE_SIZE = 25;

/** The most rows one page may ask for, so a request never loads the whole camp. */
export const PEOPLE_PAGE_SIZE_MAX = 100;

export interface PageSpan {
  /** The page shown: the requested page, held between 1 and the last page. */
  page: number;
  pageSize: number;
  pageCount: number;
  /** Rows to skip and rows to take for `page`. */
  offset: number;
  limit: number;
  /** The first and last row shown ("Showing 26 to 50"). Both are 0 when nothing matches. */
  from: number;
  to: number;
}

/** A page size from 1 to PEOPLE_PAGE_SIZE_MAX. A missing or non-numeric size gets the default; a larger one is capped. */
export function clampPageSize(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) {
    return PEOPLE_PAGE_SIZE;
  }

  return Math.min(PEOPLE_PAGE_SIZE_MAX, Math.max(1, Math.floor(requested)));
}

/**
 * The window for one page of `total` matching people. A page past the end is held at the last page (so the offset never
 * points past the rows), and an empty result still has one page, so "Page 1 of 1" is always true.
 */
export function pageSpan(total: number, requestedPage: number, requestedSize?: number): PageSpan {
  const pageSize = clampPageSize(requestedSize);
  const count = Math.max(0, Math.floor(total));
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const wanted = Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1;
  const page = Math.min(pageCount, Math.max(1, wanted));
  const offset = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    pageCount,
    offset,
    limit: pageSize,
    from: count === 0 ? 0 : offset + 1,
    to: Math.min(offset + pageSize, count),
  };
}
