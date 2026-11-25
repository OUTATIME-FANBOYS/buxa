import type { CamperRecord, ParentDetails } from '@buxa/shared';

/**
 * A child as the registration form receives them from the server: the person's name and date of birth, and the parent or guardian on
 * file (null when there is none, and no phone when the parent is not on file yet).
 */
export function camper(
  id: string,
  givenName: string,
  familyName: string,
  options: { dateOfBirth?: string | null; parent?: ParentDetails | null } = {},
): CamperRecord {
  return {
    id,
    name: `${givenName} ${familyName}`,
    givenName,
    familyName,
    dateOfBirth: options.dateOfBirth === undefined ? '2014-03-09' : options.dateOfBirth,
    parent: options.parent ?? null,
  };
}
