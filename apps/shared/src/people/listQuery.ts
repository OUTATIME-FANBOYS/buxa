import { isCampRole, type CampRole } from '@buxa/domain';
import type { PersonPageQuery } from '@buxa/contracts';
import { ROUTES } from '../config/routes';

/** The search parameters of /camp/people, read defensively: anything unknown is ignored rather than rejected. */
export interface ListParams {
  q: string;
  role: CampRole | '';
  /** The page shown, from 1. */
  page: number;
}

/** A page number from the address: a whole number of 1 or more. Anything else (missing, zero, negative, fractional, not a number) is page 1. */
export function readPage(raw: string | string[] | undefined): number {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    return 1;
  }
  const page = Number(raw);

  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

export function readListParams(raw: Record<string, string | string[] | undefined>): ListParams {
  const q = typeof raw.q === 'string' ? raw.q.trim().slice(0, 80) : '';
  const role = typeof raw.role === 'string' && isCampRole(raw.role) ? raw.role : '';

  return { q, role, page: readPage(raw.page) };
}

/** The service query for one page of these parameters (absent search and role are left out, not sent as undefined). */
export function toPageQuery({ q, role, page }: ListParams): PersonPageQuery {
  return { ...(q ? { query: q } : {}), ...(role ? { role } : {}), page };
}

/**
 * The address of one page of the list, keeping the search and role. Page 1 leaves `page` out, so the first page has the plain
 * address. A search or role change does not use this: its form drops `page`, which returns to page 1.
 */
export function peoplePageHref(params: ListParams, page: number): string {
  const search = new URLSearchParams();
  if (page > 1) {
    search.set('page', String(page));
  }
  if (params.q) {
    search.set('q', params.q);
  }
  if (params.role) {
    search.set('role', params.role);
  }
  const query = search.toString();

  return query ? `${ROUTES.people}?${query}` : ROUTES.people;
}
