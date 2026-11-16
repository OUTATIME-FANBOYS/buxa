import { badRequest, conflict, notFound } from '../../http/errors';
import { isBadgeConflict } from '../../credentials/CredentialRepository';
import { isMembershipNotFound } from '../../memberships/MembershipRepository';
import { isHouseholdNotFound, isPersonNotFound } from '../../people/PeopleRepository';
import { isOrgNotFound } from '../../orgs/OrgRepository';

/**
 * Storage errors that mean "not in this camp" become a 404 the client can show, and a lost write race becomes a 409. Values the
 * database refuses (a check constraint, a value too long or of the wrong type) become a 400 with a generic message: the database's
 * own text names constraints and columns, so it is never shown. Anything else is left alone and becomes a 500.
 */
export function translateRepositoryError(error: unknown): unknown {
  if (isBadgeConflict(error)) return conflict(error.message);
  if (isPersonNotFound(error)) return notFound('Person not found');
  if (isHouseholdNotFound(error)) return notFound('Household not found');
  if (isMembershipNotFound(error)) return notFound('Membership not found');
  if (isOrgNotFound(error)) return notFound('Camp not found');
  if (isRejectedValue(error)) return badRequest('One of the details is not allowed. Check the form and try again.');
  return error;
}

/** Postgres codes for a value the database refuses: 23514 check violation, 22001 too long, 22003 out of range, 22007 bad date, 22P02 bad text. */
const REJECTED_VALUE_CODES = new Set(['23514', '22001', '22003', '22007', '22P02']);
export const isRejectedValue = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && REJECTED_VALUE_CODES.has(String((error as { code?: unknown }).code));

/** Runs a repository call and translates its expected errors. */
export async function guard<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); } catch (error) { throw translateRepositoryError(error); }
}
