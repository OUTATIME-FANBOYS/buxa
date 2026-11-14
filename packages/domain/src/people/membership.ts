import type { LocalDate } from './localDate';

/** A membership's state on a given day. Computed, never stored. */
export type MembershipStatus = 'not_started' | 'valid' | 'expired' | 'revoked';
/** What a person's memberships add up to: a membership status, or `none` when they have never had one. */
export type AccessStatus = MembershipStatus | 'none';

export interface MembershipPeriod {
  startsOn: LocalDate;
  endsOn: LocalDate;
  /** Set when an admin revoked the membership. Revoked wins over every date. */
  revokedAt: string | null;
}

export function membershipStatus(m: MembershipPeriod, today: LocalDate): MembershipStatus {
  if (m.revokedAt !== null) return 'revoked';
  if (today < m.startsOn) return 'not_started';
  if (today > m.endsOn) return 'expired';
  return 'valid';
}

export interface PersonAccess<M extends MembershipPeriod> {
  status: AccessStatus;
  /** The membership the status comes from; undefined for `none`. */
  membership?: M;
}

/** Order used to pick the most informative membership when none is valid: what is coming, then what just ended, then revoked. */
const RELEVANCE: Record<Exclude<MembershipStatus, 'valid'>, number> = { not_started: 0, expired: 1, revoked: 2 };

/**
 * A person is valid if ANY membership is valid. Otherwise show the most relevant one: the next to start, else the most recently
 * ended, else a revoked one. Ties go to the later end date.
 */
export function personAccess<M extends MembershipPeriod>(memberships: readonly M[], today: LocalDate): PersonAccess<M> {
  let best: { m: M; status: MembershipStatus } | undefined;
  for (const m of memberships) {
    const status = membershipStatus(m, today);
    if (status === 'valid') return { status, membership: m };
    if (!best || beats(m, status, best.m, best.status)) best = { m, status };
  }
  return best ? { status: best.status, membership: best.m } : { status: 'none' };
}

function beats(m: MembershipPeriod, status: MembershipStatus, other: MembershipPeriod, otherStatus: MembershipStatus): boolean {
  const a = RELEVANCE[status as Exclude<MembershipStatus, 'valid'>];
  const b = RELEVANCE[otherStatus as Exclude<MembershipStatus, 'valid'>];
  if (a !== b) return a < b;
  // Same state: the earlier start for what is coming, the later end for what is over.
  return status === 'not_started' ? m.startsOn < other.startsOn : m.endsOn > other.endsOn;
}
