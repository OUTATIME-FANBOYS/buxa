import type { InviteTeacherInput } from '@buxa/contracts';
import type { Actor } from '@buxa/domain';
import type {
  InviteRecord,
  JoinProfile,
  MemberInviteRepository,
  SignedInPerson,
} from '../../invites/MemberInviteRepository';

/** An invite as it was just created or sent again. `token` is the raw link secret: shown once, never stored. */
export interface IssuedInvite {
  invite: InviteRecord;
  token: string;
}

/** What the accept page may show a signed-in person. Null (from `preview`) means unusable, and says nothing more. */
export type InvitePreview =
  | { kind: 'ready'; orgName: string; name: string; phone: string | null }
  | { kind: 'wrong-email' }
  | { kind: 'already-member'; orgName: string };

/**
 * Teacher invites: a staff member (or admin or owner) invites a teacher by email; the teacher joins with the link. Invites are
 * for the teacher role only in this build. The raw token is returned once, by create and resend, and is never stored.
 */
export interface InviteService {
  /** Needs members:invite (staff, admin, owner). Stores the token's hash and audits `member.invite`. */
  createTeacherInvite(actor: Actor, input: InviteTeacherInput): Promise<IssuedInvite>;
  /** Needs members:invite. Replaces the token of a pending invite, so the old link stops working. Audits `member.invite_resend`. */
  resendInvite(actor: Actor, inviteId: string): Promise<IssuedInvite>;
  /** Needs members:invite. The pending invites of the camp, without tokens. */
  listPendingInvites(actor: Actor): Promise<InviteRecord[]>;
  /** For the accept page. Null for an unknown, expired or used token, with no hint which. */
  previewInvite(person: SignedInPerson, token: string): Promise<InvitePreview | null>;
  /**
   * Joins the camp as a teacher and saves the signed-in person's profile, in one transaction. Refuses an unusable token (404,
   * generic), a different email (403) and a person already in the camp (409).
   */
  acceptInvite(
    person: SignedInPerson,
    token: string,
    profile: JoinProfile,
  ): Promise<{ orgId: string; orgName: string }>;
}

export interface InviteServiceDeps {
  invites: MemberInviteRepository;
}
