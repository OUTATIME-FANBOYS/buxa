import { randomUUID } from 'node:crypto';
import type { Actor } from '@buxa/domain';
import {
  InviteRefusedError,
  type InviteLookup,
  type InviteRecord,
  type JoinProfile,
  type MemberInviteRepository,
  type NewInvite,
  type SignedInPerson,
} from './MemberInviteRepository';

const INVITE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** One stored invite. The hash is kept as the database keeps it; the raw token never is. */
interface StoredInvite extends InviteRecord {
  orgId: string;
  tokenHash: Buffer;
  acceptedAt: string | null;
}

/** The fake keeps the same rules as migration 0038: the same refusal order, and the profile is written only when the join is. */
export class InMemoryMemberInviteRepository implements MemberInviteRepository {
  readonly invites: StoredInvite[] = [];
  readonly audit: { action: string; orgId: string; actorId: string | null; entityId: string; data: object }[] = [];
  /** The profile saved for each person, by user id. A join writes only the signed-in person's entry. */
  readonly profiles = new Map<string, JoinProfile>();
  /** The memberships created by joining, as (camp, person, role). */
  readonly joins: { orgId: string; userId: string; role: 'viewer' }[] = [];

  constructor(
    private readonly camps: ReadonlyMap<string, string>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  create(actor: Actor, invite: NewInvite, tokenHash: Buffer): Promise<InviteRecord> {
    const createdAt = this.now();
    const stored: StoredInvite = {
      id: randomUUID(),
      orgId: actor.orgId,
      email: invite.email,
      name: invite.name,
      phone: invite.phone,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + INVITE_DAYS * DAY_MS).toISOString(),
      tokenHash,
      acceptedAt: null,
    };
    this.invites.push(stored);
    this.audit.push({
      action: 'member.invite',
      orgId: actor.orgId,
      actorId: actor.userId,
      entityId: stored.id,
      data: { role: 'viewer' },
    });

    return Promise.resolve(toRecord(stored));
  }

  resend(actor: Actor, inviteId: string, tokenHash: Buffer): Promise<InviteRecord | null> {
    const invite = this.invites.find(i => i.id === inviteId && i.orgId === actor.orgId && i.acceptedAt === null);
    if (!invite) {
      return Promise.resolve(null);
    }
    invite.tokenHash = tokenHash;
    invite.expiresAt = new Date(this.now().getTime() + INVITE_DAYS * DAY_MS).toISOString();
    this.audit.push({
      action: 'member.invite_resend',
      orgId: actor.orgId,
      actorId: actor.userId,
      entityId: invite.id,
      data: { role: 'viewer' },
    });

    return Promise.resolve(toRecord(invite));
  }

  listPending(actor: Actor): Promise<InviteRecord[]> {
    const rows = this.invites
      .filter(i => i.orgId === actor.orgId && i.acceptedAt === null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return Promise.resolve(rows.map(toRecord));
  }

  lookup(person: SignedInPerson, tokenHash: Buffer): Promise<InviteLookup | null> {
    const invite = this.usable(tokenHash);
    if (!invite) {
      return Promise.resolve(null);
    }

    return Promise.resolve({
      orgId: invite.orgId,
      orgName: this.camps.get(invite.orgId) ?? '',
      name: invite.name,
      phone: invite.phone,
      emailMatches: invite.email === person.email,
      alreadyMember: this.isMember(invite.orgId, person.userId),
    });
  }

  accept(person: SignedInPerson, tokenHash: Buffer, profile: JoinProfile): Promise<{ orgId: string; orgName: string }> {
    const invite = this.usable(tokenHash);
    if (!invite) {
      return Promise.reject(new InviteRefusedError('unusable'));
    }
    if (invite.email !== person.email) {
      return Promise.reject(new InviteRefusedError('wrong-email'));
    }
    if (this.isMember(invite.orgId, person.userId)) {
      return Promise.reject(new InviteRefusedError('already-member'));
    }
    // Only now is anything written: the profile of the signed-in person, the membership, and the accepted mark.
    this.profiles.set(person.userId, profile);
    this.joins.push({ orgId: invite.orgId, userId: person.userId, role: 'viewer' });
    invite.acceptedAt = this.now().toISOString();
    this.audit.push({
      action: 'member.invite_accept',
      orgId: invite.orgId,
      actorId: person.userId,
      entityId: person.userId,
      data: { role: 'viewer' },
    });

    return Promise.resolve({ orgId: invite.orgId, orgName: this.camps.get(invite.orgId) ?? '' });
  }

  private usable(tokenHash: Buffer): StoredInvite | undefined {
    const now = this.now().getTime();

    return this.invites.find(
      i => i.tokenHash.equals(tokenHash) && i.acceptedAt === null && Date.parse(i.expiresAt) > now,
    );
  }

  private isMember(orgId: string, userId: string): boolean {
    return this.joins.some(j => j.orgId === orgId && j.userId === userId);
  }
}

const toRecord = (i: StoredInvite): InviteRecord => ({
  id: i.id,
  email: i.email,
  name: i.name,
  phone: i.phone,
  createdAt: i.createdAt,
  expiresAt: i.expiresAt,
});
