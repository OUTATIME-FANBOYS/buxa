import type { Actor, LocalDate, MembershipPeriod } from '@buxa/domain';

export interface MembershipRecord extends MembershipPeriod {
  id: string;
  personId: string;
  plan: string;
  revokedReason: string | null;
}

export interface NewMembershipRecord { personId: string; plan: string; startsOn: LocalDate; endsOn: LocalDate }

export class MembershipNotFoundError extends Error {
  readonly kind = 'membership-not-found';
  constructor() { super('Membership not found'); this.name = 'MembershipNotFoundError'; }
}
export const isMembershipNotFound = (e: unknown): e is MembershipNotFoundError => e instanceof Error && (e as { kind?: unknown }).kind === 'membership-not-found';

/** Storage for memberships (a person's right to attend for a date range). Status is computed by the caller, never stored. */
export interface MembershipRepository {
  /** Audits `membership.create`. Throws PersonNotFoundError for an unknown person. */
  add(actor: Actor, input: NewMembershipRecord): Promise<MembershipRecord>;
  /** Idempotent: revoking a revoked membership keeps the first reason. Audits `membership.revoke`. Throws MembershipNotFoundError. */
  revoke(actor: Actor, id: string, reason: string, at: string): Promise<MembershipRecord>;
  /** Oldest start first. */
  forPerson(orgId: string, personId: string): Promise<MembershipRecord[]>;
  /** One query for a whole list screen. */
  forPeople(orgId: string, personIds: readonly string[]): Promise<MembershipRecord[]>;
}
