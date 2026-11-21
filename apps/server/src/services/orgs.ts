import type { ArchivedCampRecord } from '../orgs/OrgRepository';
import type {
  ChangeMemberRoleInput,
  CreatedOrg,
  Members,
  NewOrgInput,
  Org,
  OrgPatchInput,
  OrgSummary,
} from '@buxa/contracts';
import { can, type Actor } from '@buxa/domain';
import { assertAllowed } from '../auth/authorize';
import { badRequest, conflict, notFound } from '../http/errors';
import { isSlugTaken, type OrgRepository } from '../orgs/OrgRepository';
import { guard } from './shared/errors';

/**
 * What can be done with camps. Route handlers call it now and Server Actions will too, so the rules (who may do what, what a
 * duplicate address means) live here once. It never sees HTTP: callers parse input and work out the Actor.
 */
export interface OrgService {
  createCamp(ownerId: string, input: NewOrgInput): Promise<CreatedOrg>;
  getCamp(actor: Actor): Promise<Org>;
  renameCamp(actor: Actor, input: OrgPatchInput): Promise<OrgSummary>;
  listMembers(actor: Actor): Promise<Members>;
  /** Needs members:change_role. Sets one member's permission role; the rules (self, owner, last owner) are checked here and in the database. */
  changeMemberRole(actor: Actor, input: ChangeMemberRoleInput): Promise<void>;
  /** Owner only. Hides the camp and keeps all its data. */
  archiveCamp(actor: Actor, orgId: string): Promise<{ archivedAt: string }>;
  /** Owner only. Makes an archived camp active again; its data is unchanged. Refuses a camp that is not archived. */
  unarchiveCamp(actor: Actor, orgId: string): Promise<void>;
  /** Owner only. Removes the camp and everything in it. `confirmName` must equal the camp's name exactly (capitals included). */
  deleteCamp(actor: Actor, orgId: string, confirmName: string): Promise<void>;
  /** The archived camps this person belongs to. Read-only; any role may see them. */
  listArchivedCamps(userId: string): Promise<ArchivedCampRecord[]>;
}

export function createOrgService(orgs: OrgRepository): OrgService {
  return {
    async createCamp(ownerId, input) {
      // Any signed-in person may start a camp; they become its owner.
      try {
        return await orgs.createWithOwner(input, ownerId);
      } catch (error) {
        throw isSlugTaken(error) ? conflict(error.message) : error;
      }
    },
    async getCamp(actor) {
      assertAllowed(actor, 'org:read');

      return guard(() => orgs.get(actor.userId, actor.orgId));
    },
    async renameCamp(actor, input) {
      assertAllowed(actor, 'org:update');

      return guard(() => orgs.rename(actor, input));
    },
    async listMembers(actor) {
      assertAllowed(actor, 'members:read');
      const members = await orgs.listMembers(actor.userId, actor.orgId);
      // Staff email addresses are for admins and above. Everyone else gets names and roles.
      const seeEmail = can(actor, 'members:read_contact');

      return { members: members.map(m => ({ ...m, email: seeEmail ? m.email : null })) };
    },
    async changeMemberRole(actor, input) {
      const members = await guard(() => orgs.listMembers(actor.userId, actor.orgId));
      const target = members.find(m => m.id === input.userId);
      if (!target) {
        throw notFound('Person not found');
      }
      assertAllowed(actor, 'members:change_role', {
        orgId: actor.orgId,
        target: { userId: target.id, role: target.role },
        newRole: input.role,
      });
      await guard(() => orgs.changeMemberRole(actor, input.userId, input.role));
    },
    async archiveCamp(actor, orgId) {
      assertAllowed(actor, 'org:archive', { orgId });

      return guard(() => orgs.archive(actor));
    },
    async unarchiveCamp(actor, orgId) {
      assertAllowed(actor, 'org:unarchive', { orgId });

      await guard(() => orgs.unarchive(actor));
    },
    async deleteCamp(actor, orgId, confirmName) {
      assertAllowed(actor, 'org:delete', { orgId });
      const camp = await guard(() => orgs.get(actor.userId, actor.orgId));
      if (confirmName !== camp.name) {
        throw badRequest(
          'To delete the camp, type its name exactly as it is written, capitals included. Nothing was deleted.',
        );
      }
      await guard(() => orgs.deleteCamp(actor, confirmName));
    },
    async listArchivedCamps(userId) {
      return guard(() => orgs.archivedCampsOf(userId));
    },
  };
}
