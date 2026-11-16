import { isCampRole, type CampRole } from '@buxa/domain';
import type { PersonListQuery } from '@buxa/contracts';

/** The search parameters of /camp/people, read defensively: anything unknown is ignored rather than rejected. */
export interface ListParams { q: string; role: CampRole | '' }

export function readListParams(raw: Record<string, string | string[] | undefined>): ListParams {
  const q = typeof raw.q === 'string' ? raw.q.trim().slice(0, 80) : '';
  const role = typeof raw.role === 'string' && isCampRole(raw.role) ? raw.role : '';
  return { q, role };
}

/** The service query for these parameters (absent values are left out, not sent as undefined). */
export function toListQuery({ q, role }: ListParams): PersonListQuery {
  return { ...(q ? { query: q } : {}), ...(role ? { role } : {}) };
}
