import type { CreatedOrg, Members, NewOrgInput, Org, OrgPatchInput, OrgSummary } from '@buxa/contracts';
import type { Actor } from '@buxa/domain';
import { assertAllowed } from '../auth/authorize';
import { conflict } from '../http/errors';
import { isSlugTaken, type OrgRepository } from '../orgs/OrgRepository';

/**
 * What can be done with camps. Route handlers call it now and Server Actions will too, so the rules (who may do what, what a
 * duplicate address means) live here once. It never sees HTTP: callers parse input and work out the Actor.
 */
export interface OrgService {
  createCamp(ownerId: string, input: NewOrgInput): Promise<CreatedOrg>;
  getCamp(actor: Actor): Promise<Org>;
  renameCamp(actor: Actor, input: OrgPatchInput): Promise<OrgSummary>;
  listMembers(actor: Actor): Promise<Members>;
}

export function createOrgService(orgs: OrgRepository): OrgService {
  return {
    async createCamp(ownerId, input) {
      // Any signed-in person may start a camp; they become its owner.
      try { return await orgs.createWithOwner(input, ownerId); }
      catch (error) { throw isSlugTaken(error) ? conflict(error.message) : error; }
    },
    async getCamp(actor) {
      assertAllowed(actor, 'org:read');
      return orgs.get(actor.orgId);
    },
    async renameCamp(actor, input) {
      assertAllowed(actor, 'org:update');
      return orgs.rename(actor, input);
    },
    async listMembers(actor) {
      assertAllowed(actor, 'members:read');
      return { members: await orgs.listMembers(actor.orgId) };
    },
  };
}
