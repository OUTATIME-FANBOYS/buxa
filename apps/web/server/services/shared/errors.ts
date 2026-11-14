import { notFound } from '../../http/errors';
import { isMembershipNotFound } from '../../memberships/MembershipRepository';
import { isHouseholdNotFound, isPersonNotFound } from '../../people/PeopleRepository';

/**
 * Storage errors that mean "not in this camp" become a 404 the client can show. Anything else is left alone and becomes a 500.
 */
export function translateRepositoryError(error: unknown): unknown {
  if (isPersonNotFound(error)) return notFound('Person not found');
  if (isHouseholdNotFound(error)) return notFound('Household not found');
  if (isMembershipNotFound(error)) return notFound('Membership not found');
  return error;
}

/** Runs a repository call and translates its expected errors. */
export async function guard<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); } catch (error) { throw translateRepositoryError(error); }
}
