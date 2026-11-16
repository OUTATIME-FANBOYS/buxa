import type { NewMembershipInput, PersonMembership, RevokeMembershipInput } from '@buxa/contracts';
import type { Actor } from '@buxa/domain';
import type { MembershipRepository } from '../../memberships/MembershipRepository';
import type { OrgRepository } from '../../orgs/OrgRepository';
import type { PeopleRepository } from '../../people/PeopleRepository';
import type { Clock } from '../clock';

/** Memberships: a person's right to attend for a date range. Status is computed for the camp's local day, never stored. */
export interface MembershipService {
  /** Needs memberships:manage. 404 for an unknown person. */
  add(actor: Actor, input: NewMembershipInput): Promise<PersonMembership>;
  /** Needs memberships:manage. The reason is required and recorded. */
  revoke(actor: Actor, input: RevokeMembershipInput): Promise<PersonMembership>;
  /** Needs people:read. */
  listFor(actor: Actor, personId: string): Promise<PersonMembership[]>;
}

export interface MembershipServiceDeps { memberships: MembershipRepository; people: PeopleRepository; orgs: OrgRepository; clock: Clock }
