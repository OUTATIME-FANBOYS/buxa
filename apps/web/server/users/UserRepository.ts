import type { Membership, User } from '@buxa/contracts';
import type { Identity } from '../auth/identity';

/** Raised when a different identity already owns this email address. */
export class EmailInUseError extends Error {
  readonly kind = 'email-in-use';
  constructor() { super('This email address is already linked to a different account'); this.name = 'EmailInUseError'; }
}

/** True for an EmailInUseError from any copy of this module (see isHttpError for why not `instanceof`). */
export const isEmailInUse = (error: unknown): error is EmailInUseError => error instanceof Error && (error as { kind?: unknown }).kind === 'email-in-use';

export interface UserRepository {
  /** Finds our user for a verified identity, creating it on first sign-in. Linked by the provider's id, never by email. */
  upsertFromIdentity(identity: Identity): Promise<User>;
  /** Every organisation the user belongs to, with their role in each. */
  membershipsOf(userId: string): Promise<Membership[]>;
}
