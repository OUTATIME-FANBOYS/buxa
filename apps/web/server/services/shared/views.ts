import { membershipStatus, personAccess, type LocalDate } from '@buxa/domain';
import type { Household, PersonMembership, PersonSummary } from '@buxa/contracts';
import type { AttendanceRepository, CheckInRecord } from '../../attendance/AttendanceRepository';
import type { MembershipRecord } from '../../memberships/MembershipRepository';
import type { HouseholdRecord, PeopleRepository, PersonRecord } from '../../people/PeopleRepository';
import type { OrgRepository } from '../../orgs/OrgRepository';

/** The name a person is shown by: preferred name if they have one, then family name. */
export const displayName = (person: Pick<PersonRecord, 'givenName' | 'familyName' | 'preferredName'>): string =>
  `${person.preferredName ?? person.givenName} ${person.familyName}`;

/** The camp's zone. "Today" and every shown time come from here. */
export async function campZone(orgs: OrgRepository, orgId: string): Promise<string> {
  return (await orgs.get(orgId)).timezone;
}

export function toPersonMembership(record: MembershipRecord, today: LocalDate): PersonMembership {
  return {
    id: record.id, personId: record.personId, plan: record.plan, startsOn: record.startsOn, endsOn: record.endsOn,
    revokedAt: record.revokedAt, revokedReason: record.revokedReason, status: membershipStatus(record, today),
  };
}

/** The list row for a person. Names, roles and status only, so it is safe for every role. */
export function toSummary(person: PersonRecord, memberships: readonly MembershipRecord[], onSite: boolean, today: LocalDate): PersonSummary {
  return {
    id: person.id, givenName: person.givenName, familyName: person.familyName, preferredName: person.preferredName,
    roles: [...person.roles], status: personAccess(memberships, today).status, onSite, archived: person.archivedAt !== null,
  };
}

/** Households with each member's name and roles resolved in one lookup. Members who are no longer in the camp are left out. */
export async function toHouseholds(people: PeopleRepository, orgId: string, records: readonly HouseholdRecord[]): Promise<Household[]> {
  const ids = [...new Set(records.flatMap(h => h.members.map(m => m.personId)))];
  const byId = new Map((await people.getMany(orgId, ids)).map(p => [p.id, p] as const));
  return records.map(h => ({
    id: h.id,
    name: h.name,
    members: h.members.flatMap(m => {
      const p = byId.get(m.personId);
      return p ? [{
        personId: m.personId, givenName: p.givenName, familyName: p.familyName, roles: [...p.roles],
        relationship: m.relationship, isGuardian: m.isGuardian, canPickup: m.canPickup,
      }] : [];
    }),
  }));
}

/** The open visit for each person who is on site now, keyed by person id. */
export async function onSiteByPerson(attendance: AttendanceRepository, orgId: string): Promise<Map<string, CheckInRecord>> {
  return new Map((await attendance.onSite(orgId)).map(v => [v.personId, v] as const));
}
