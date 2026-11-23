import type { IssuedBadge } from '@buxa/contracts';
import type { Actor, CampRole } from '@buxa/domain';
import type { AttendanceRepository } from '../../attendance/AttendanceRepository';
import type { BadgeCipher } from '../../credentials/badgeCipher';
import type { CredentialRepository } from '../../credentials/CredentialRepository';
import type { MembershipRepository } from '../../memberships/MembershipRepository';
import type { OrgRepository } from '../../orgs/OrgRepository';
import type { PeopleRepository } from '../../people/PeopleRepository';
import type { Clock } from '../clock';

/** The outcome of reading a code. `unknown` is the single neutral answer for unreadable, unknown and revoked codes alike. */
import type { ScanResult } from '@buxa/shared/attendance/types';
export type { ScanResult };

/**
 * What showing a badge gives back. `shown` carries the payload the QR code encodes. `reissue` means the badge was issued before
 * encrypted copies existed, so it cannot be shown: the camp must reissue it.
 */
export type BadgeReveal = { kind: 'shown'; payload: string } | { kind: 'reissue' };

/** A badge a signed-in person may show from their profile: their own, and their children's for a guardian. */
export interface ProfileBadge {
  personId: string;
  name: string;
  roles: CampRole[];
  hasActiveBadge: boolean;
  /** True for the signed-in person's own record; false for a child of theirs. */
  self: boolean;
}

/**
 * Badges. A token is 128 random bits from a CSPRNG and is stored as a SHA-256 hash, which is the lookup key at check-in. The token is
 * also kept encrypted (see badgeCipher.ts) so the badge can be shown again. Reissuing revokes the old badge.
 */
export interface CredentialService {
  /** Needs credentials:manage. Returns the token ONCE. Refuses archived people (409). */
  issue(actor: Actor, personId: string): Promise<IssuedBadge>;
  /** Needs credentials:manage. Idempotent. */
  revoke(actor: Actor, personId: string): Promise<void>;
  /**
   * Shows the active badge. Allowed for credentials:manage (any person), for the person themself (matched by email), and for a
   * guardian of that person's household. Audits `badge.view`. `viewerEmail` is the signed-in user's email, from the session.
   */
  show(actor: Actor, personId: string, viewerEmail: string): Promise<BadgeReveal>;
  /** Needs credentials:manage. Shows the same code again for a damaged card. Audits `badge.reprint`. */
  reprint(actor: Actor, personId: string): Promise<BadgeReveal>;
  /** The badges the signed-in person may show from their profile: their own, plus each child's for a guardian. */
  badgesFor(actor: Actor, viewerEmail: string): Promise<ProfileBadge[]>;
  /**
   * Needs attendance:read. `raw` is whatever the scanner typed or the camera read. Never reveals whether a code ever existed:
   * a malformed, unknown, revoked or archived-person code all return `{ kind: 'unknown' }`.
   */
  scan(actor: Actor, raw: string): Promise<ScanResult>;
}

export interface CredentialServiceDeps {
  credentials: CredentialRepository;
  people: PeopleRepository;
  memberships: MembershipRepository;
  attendance: AttendanceRepository;
  orgs: OrgRepository;
  clock: Clock;
  /** Seals and opens the encrypted copy of a badge token. The server uses the one keyed by BADGE_ENCRYPTION_KEY. */
  cipher: BadgeCipher;
}
