'use client';

import { useState, type ReactNode } from 'react';
import { DEFAULT_PAGE_SIZE, pageOf } from '@buxa/shared';
import { Button } from '../Button';

/*
 * Pages a list instead of letting it scroll. The caller passes every item and renders the current page through `children`.
 * The current page is kept here. When `resetKey` changes (the search text, a filter), the list goes back to page 1. The
 * controls appear only when the list needs more than one page, right-aligned under the items.
 */
export interface PaginationProps<T> {
  items: readonly T[];
  /** Items per page. Defaults to 10. */
  pageSize?: number;
  /** When this value changes, the list returns to page 1. Pass the search text here. */
  resetKey?: string;
  /** Names the pages for screen readers, for example "Pages of campers not placed yet". */
  label: string;
  /** Renders the items of the current page. */
  children: (pageItems: readonly T[]) => ReactNode;
}

interface PageState {
  resetKey: string;
  page: number;
}

export function Pagination<T>({
  items,
  pageSize = DEFAULT_PAGE_SIZE,
  resetKey = '',
  label,
  children,
}: PaginationProps<T>) {
  const [state, setState] = useState<PageState>({ resetKey, page: 1 });
  const requested = state.resetKey === resetKey ? state.page : 1;
  const view = pageOf(items, requested, pageSize);
  const goTo = (page: number) => setState({ resetKey, page });

  return (
    <>
      {children(view.items)}
      {view.pageCount > 1 && (
        <nav className="pagination" aria-label={label}>
          <p className="pagination__status muted" aria-live="polite">
            {`Showing ${view.from}–${view.to} of ${view.total}`}
          </p>
          <Button
            variant="glass"
            size="sm"
            type="button"
            icon="left"
            aria-label="Previous page"
            disabled={view.page <= 1}
            onClick={() => goTo(view.page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="glass"
            size="sm"
            type="button"
            icon="right"
            aria-label="Next page"
            disabled={view.page >= view.pageCount}
            onClick={() => goTo(view.page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </>
  );
}
