import type { IssuedBadge, PersonSummary } from '@buxa/contracts';
import type { Actor } from '@buxa/domain';
import type { AttendanceRepository } from '../../attendance/AttendanceRepository';
import type { CredentialRepository } from '../../credentials/CredentialRepository';
import type { MembershipRepository } from '../../memberships/MembershipRepository';
import type { OrgRepository } from '../../orgs/OrgRepository';
import type { PeopleRepository } from '../../people/PeopleRepository';
import type { Clock } from '../clock';

/** The outcome of reading a code. `unknown` is the single neutral answer for unreadable, unknown and revoked codes alike. */
export type ScanResult = { kind: 'unknown' } | { kind: 'person'; person: PersonSummary };

/**
 * Badges. A token is 128 random bits from a CSPRNG, shown once, stored only as a SHA-256 hash (see `lib/qr`, chunk P5, for the
 * token and hash helpers the implementation must use). Comparison is by hash lookup; reissuing revokes the old badge.
 */
export interface CredentialService {
  /** Needs credentials:manage. Returns the token ONCE. Refuses archived people (409). */
  issue(actor: Actor, personId: string): Promise<IssuedBadge>;
  /** Needs credentials:manage. Idempotent. */
  revoke(actor: Actor, personId: string): Promise<void>;
  /**
   * Needs attendance:read. `raw` is whatever the scanner typed or the camera read. Never reveals whether a code ever existed:
   * a malformed, unknown, revoked or archived-person code all return `{ kind: 'unknown' }`.
   */
  scan(actor: Actor, raw: string): Promise<ScanResult>;
}

export interface CredentialServiceDeps {
  credentials: CredentialRepository; people: PeopleRepository; memberships: MembershipRepository; attendance: AttendanceRepository;
  orgs: OrgRepository; clock: Clock;
}
