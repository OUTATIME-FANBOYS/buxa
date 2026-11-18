import type { ClockFormat, Membership, User } from '@buxa/contracts';
import type { Identity } from '../auth/identity';

/** Raised when a different identity already owns this email address. */
export class EmailInUseError extends Error {
  readonly kind = 'email-in-use';
  constructor() {
    super('This email address is already linked to a different account');
    this.name = 'EmailInUseError';
  }
}

/** True for an EmailInUseError from any copy of this module (see isHttpError for why not `instanceof`). */
export const isEmailInUse = (error: unknown): error is EmailInUseError =>
  error instanceof Error && (error as { kind?: unknown }).kind === 'email-in-use';

export interface UserRepository {
  /** Finds our user for a verified identity, creating it on first sign-in. Linked by the provider's id, never by email. */
  upsertFromIdentity(identity: Identity): Promise<User>;
  /** Every organisation the user belongs to, with their role in each. */
  membershipsOf(userId: string): Promise<Membership[]>;
  /** The archived organisations the user belongs to, read-only. Used to open an archived camp; never to write to it. */
  archivedMembershipsOf(userId: string): Promise<Membership[]>;
  /** Saves the person's own first and last name; the full name is rebuilt from them. The caller passes only the signed-in person's id. Sign-in never overwrites a saved name. */
  updateName(userId: string, name: { firstName: string; lastName: string | null }): Promise<User>;
  /** Saves the person's own 12-hour or 24-hour clock. The caller passes only the signed-in person's id. */
  setClockFormat(userId: string, clockFormat: ClockFormat): Promise<User>;
  /** The role `userId` holds in the camp, or null if they are not in it. Read inside that camp's row-level security. */
  roleIn(orgId: string, userId: string): Promise<Membership['role'] | null>;
  /** Renames a member of the camp, for an admin or owner. Refuses (null) anyone not in the camp. The caller checks the rank. */
  renameMember(orgId: string, userId: string, name: string): Promise<Pick<User, 'id' | 'email' | 'name'> | null>;
}
