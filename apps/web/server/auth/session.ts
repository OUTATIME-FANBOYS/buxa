import type { Membership, User } from '@buxa/contracts';

/** Who is signed in on this request and which camps they belong to. */
export interface Session { readonly user: User; readonly memberships: readonly Membership[] }
