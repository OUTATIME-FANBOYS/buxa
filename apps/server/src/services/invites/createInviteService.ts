import { assertAllowed } from '../../auth/authorize';
import { conflict, forbidden, notFound } from '../../http/errors';
import { generateInviteToken, hashInviteToken, looksLikeInviteToken } from '../../invites/inviteToken';
import { isInviteRefused, type SignedInPerson } from '../../invites/MemberInviteRepository';
import { guard } from '../shared/errors';
import type { InviteService, InviteServiceDeps } from './InviteService';

/** The one answer for an invite that cannot be used. It never says whether the email has an account, or why. */
export const INVITE_UNUSABLE_MESSAGE = 'This invite cannot be used. Ask the camp for a new one.';

export function createInviteService({ invites }: InviteServiceDeps): InviteService {
  return {
    async createTeacherInvite(actor, input) {
      // Teachers are the only role an invite can grant in this build; the check is written out here as well as in the database.
      assertAllowed(actor, 'members:invite', { orgId: actor.orgId, newRole: 'teacher' });
      const token = generateInviteToken();
      const invite = await guard(() =>
        invites.create(
          actor,
          { email: input.email, name: input.name, phone: input.phone || null },
          hashInviteToken(token),
        ),
      );

      return { invite, token };
    },

    async resendInvite(actor, inviteId) {
      assertAllowed(actor, 'members:invite', { orgId: actor.orgId, newRole: 'teacher' });
      const token = generateInviteToken();
      const invite = await guard(() => invites.resend(actor, inviteId, hashInviteToken(token)));
      if (!invite) {
        throw notFound('This invite cannot be sent again. It may already have been used.');
      }

      return { invite, token };
    },

    async listPendingInvites(actor) {
      assertAllowed(actor, 'members:invite', { orgId: actor.orgId, newRole: 'teacher' });

      return guard(() => invites.listPending(actor));
    },

    async previewInvite(person, token) {
      if (!looksLikeInviteToken(token)) {
        return null;
      }
      const found = await guard(() => invites.lookup(person, hashInviteToken(token)));
      if (!found) {
        return null;
      }
      // The same order as the database refusals: the email is checked before membership.
      if (!found.emailMatches) {
        return { kind: 'wrong-email' };
      }
      if (found.alreadyMember) {
        return { kind: 'already-member', orgName: found.orgName };
      }

      return { kind: 'ready', orgName: found.orgName, name: found.name, phone: found.phone };
    },

    async acceptInvite(person: SignedInPerson, token, profile) {
      if (!looksLikeInviteToken(token)) {
        throw notFound(INVITE_UNUSABLE_MESSAGE);
      }
      try {
        return await guard(() => invites.accept(person, hashInviteToken(token), profile));
      } catch (error) {
        if (!isInviteRefused(error)) {
          throw error;
        }
        switch (error.reason) {
          case 'unusable':
            throw notFound(INVITE_UNUSABLE_MESSAGE);
          case 'wrong-email':
            throw forbidden('This invite is for another email address.');
          case 'already-member':
            throw conflict('You are already in this camp.');
        }
      }
    },
  };
}
