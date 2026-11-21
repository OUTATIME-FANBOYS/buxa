import type { Actor } from '@buxa/domain';

/** A pending or used invite as the camp sees it. The token and its hash are never part of it. */
export interface InviteRecord {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface NewInvite {
  email: string;
  name: string;
  phone: string | null;
}

/** The signed-in person who is joining. Only their id is used for the database; the email is compared in the database. */
export interface SignedInPerson {
  userId: string;
  email: string;
}

/** The profile the teacher confirms. It is saved to their own user row in the same transaction as the join. */
export interface JoinProfile {
  firstName: string;
  lastName: string | null;
  phone: string | null;
}

/** What the accept page may show before a person joins. */
export interface InviteLookup {
  orgId: string;
  orgName: string;
  name: string;
  phone: string | null;
  emailMatches: boolean;
  alreadyMember: boolean;
}

/** Why a join was refused. The database names the reason; the service turns it into a message. */
export type InviteRefusal = 'unusable' | 'wrong-email' | 'already-member';

/** A refused join. Recognised by its marker, not `instanceof` (see HttpError in http/errors.ts). */
export class InviteRefusedError extends Error {
  readonly kind = 'invite-refused';
  constructor(readonly reason: InviteRefusal) {
    super(`The invite was refused: ${reason}`);
    this.name = 'InviteRefusedError';
  }
}

export const isInviteRefused = (error: unknown): error is InviteRefusedError =>
  error instanceof Error && 'kind' in error && error.kind === 'invite-refused';

export interface MemberInviteRepository {
  /** Stores a new teacher invite and audits `member.invite` in the same transaction. Only the hash reaches storage. */
  create(actor: Actor, invite: NewInvite, tokenHash: Buffer): Promise<InviteRecord>;
  /**
   * Replaces the token hash (and resets the expiry) of a pending invite, so the old link stops working. Audits
   * `member.invite_resend`. Null when the invite is not a pending one in this camp.
   */
  resend(actor: Actor, inviteId: string, tokenHash: Buffer): Promise<InviteRecord | null>;
  /** The camp's pending invites, newest first. Staff, admins and owners only (row-level security). */
  listPending(actor: Actor): Promise<InviteRecord[]>;
  /** The invite a token names, for the accept page. Null for an unknown, expired or used token. */
  lookup(person: SignedInPerson, tokenHash: Buffer): Promise<InviteLookup | null>;
  /**
   * Saves the profile and joins the camp as a teacher, in one transaction. Throws InviteRefusedError when the invite cannot be
   * used, the email is another one, or the person is already in the camp; the profile is then not saved either.
   */
  accept(person: SignedInPerson, tokenHash: Buffer, profile: JoinProfile): Promise<{ orgId: string; orgName: string }>;
}
