import type { AttendanceEntry } from '@buxa/contracts';
import type { CheckInRecord } from '../../attendance/AttendanceRepository';
import type { OrgRepository } from '../../orgs/OrgRepository';
import type { PeopleRepository } from '../../people/PeopleRepository';
import { displayName } from '../shared/views';
import type { PickupOption } from './AttendanceService';

/**
 * Visits as the screens show them: names resolved, one lookup for the people and one for the staff. Order is kept.
 */
export async function toEntries(
  deps: { people: PeopleRepository; orgs: OrgRepository }, orgId: string, records: readonly CheckInRecord[],
): Promise<AttendanceEntry[]> {
  const personIds = records.flatMap(r => (r.collectedByPersonId === null ? [r.personId] : [r.personId, r.collectedByPersonId]));
  const [named, staff] = await Promise.all([deps.people.getMany(orgId, [...new Set(personIds)]), deps.orgs.listMembers(orgId)]);
  const personNames = new Map(named.map(p => [p.id, displayName(p)] as const));
  const staffNames = new Map(staff.map(m => [m.id, m.name] as const));
  const staffName = (id: string | null): string | null => (id === null ? null : staffNames.get(id) ?? null);
  return records.map(r => ({
    id: r.id,
    personId: r.personId,
    personName: personNames.get(r.personId) ?? 'Unknown person',
    checkedInAt: r.checkedInAt,
    checkedInByName: staffName(r.checkedInBy),
    method: r.method,
    checkedOutAt: r.checkedOutAt,
    checkedOutByName: staffName(r.checkedOutBy),
    collectedByName: r.collectedByPersonId === null ? null : personNames.get(r.collectedByPersonId) ?? null,
    overrideReason: r.overrideReason,
    note: r.note,
  }));
}

/**
 * Who may collect a child: a guardian with can_pickup in one of the child's households, keyed by person id, with the relationship
 * the link records. The child is never their own collector.
 */
export async function authorisedCollectors(people: PeopleRepository, orgId: string, childId: string): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const household of await people.householdsOf(orgId, childId)) {
    for (const member of household.members) {
      if (member.isGuardian && member.canPickup && member.personId !== childId && !found.has(member.personId)) {
        found.set(member.personId, member.relationship);
      }
    }
  }
  return found;
}

/** The people a child can be collected by, named and sorted by name. */
export async function pickupOptionsFor(people: PeopleRepository, orgId: string, childId: string): Promise<PickupOption[]> {
  const collectors = await authorisedCollectors(people, orgId, childId);
  const named = await people.getMany(orgId, [...collectors.keys()]);
  return named
    .map(p => ({ personId: p.id, name: displayName(p), relationship: collectors.get(p.id) ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
