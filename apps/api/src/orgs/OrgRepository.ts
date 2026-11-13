import type { CreatedOrg, Member, NewOrgInput, Org, OrgPatchInput, OrgSummary } from '@buxa/contracts';
import type { Actor } from '@buxa/domain';

/** Raised when another organisation already uses the requested address. */
export class SlugTakenError extends Error {
  constructor() { super('That address is already taken'); this.name = 'SlugTakenError'; }
}
/** Raised when an organisation is not visible to the caller (it does not exist, or row-level security hides it). */
export class OrgNotFoundError extends Error {
  constructor() { super('Organisation not found'); this.name = 'OrgNotFoundError'; }
}

/**
 * Everything the API needs to know about organisations. Callers decide *whether* something may happen
 * (permissions, in @buxa/domain); implementations decide *how* it is stored.
 */
export interface OrgRepository {
  /** Creates the organisation, makes `ownerId` its owner and records the audit entry, atomically. */
  createWithOwner(input: NewOrgInput, ownerId: string): Promise<CreatedOrg>;
  get(orgId: string): Promise<Org>;
  rename(actor: Actor, input: OrgPatchInput): Promise<OrgSummary>;
  listMembers(orgId: string): Promise<Member[]>;
}
