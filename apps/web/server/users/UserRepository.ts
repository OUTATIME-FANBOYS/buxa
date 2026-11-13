import type { Membership, User } from '@buxa/contracts';
import type { Identity } from '../auth/identity';

/** Raised when a different identity already owns this email address. */
export class EmailInUseError extends Error {
  constructor() { super('This email address is already linked to a different account'); this.name = 'EmailInUseError'; }
}

export interface UserRepository {
  /** Finds our user for a verified identity, creating it on first sign-in. Linked by the provider's id, never by email. */
  upsertFromIdentity(identity: Identity): Promise<User>;
  /** Every organisation the user belongs to, with their role in each. */
  membershipsOf(userId: string): Promise<Membership[]>;
}
