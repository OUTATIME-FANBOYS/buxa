import { peoplePageHref, type ListParams } from '@buxa/shared';
import { Button } from '@/components/elements';

/**
 * The bar under the people table: the range shown, Previous and Next, and "Page X of Y". Previous is off on the first page and
 * Next on the last. The buttons are links to the address of the other page, so the page is in the URL and back works.
 */
export function PeoplePagination({
  params,
  page,
  pageCount,
  from,
  to,
  total,
}: {
  params: ListParams;
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
}) {
  const previous = page > 1 ? peoplePageHref(params, page - 1) : undefined;
  const next = page < pageCount ? peoplePageHref(params, page + 1) : undefined;

  return (
    <nav aria-label="People pages" className="buxa:flex buxa:flex-col buxa:items-center buxa:gap-3">
      <p className="muted">
        Showing {from} to {to} of {total} {total === 1 ? 'person' : 'people'}
      </p>
      <div className="buxa:flex buxa:flex-wrap buxa:items-center buxa:justify-center buxa:gap-3">
        {previous ? (
          <Button href={previous} variant="glass">
            Previous
          </Button>
        ) : (
          <Button type="button" variant="glass" disabled>
            Previous
          </Button>
        )}
        <span className="muted">
          Page {page} of {pageCount}
        </span>
        {next ? (
          <Button href={next} variant="glass">
            Next
          </Button>
        ) : (
          <Button type="button" variant="glass" disabled>
            Next
          </Button>
        )}
      </div>
    </nav>
  );
}
