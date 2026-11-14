import type { Actor } from '@buxa/domain';
import type { Services } from '../../apps/web/server/runtime';
import { ADULTS, families, type MembershipState, type RosterCamper, type RosterFamily, type RosterGuardian } from './roster';

/** The ids the visit script needs, in roster order. */
export interface RosterIds {
  campers: string[];
  /** The first guardian of each family, who may collect every child in it. */
  primaryGuardians: string[];
  adults: Record<string, string>;
}

export interface RosterCounts { people: number; households: number; memberships: number; badges: number }

/** Membership through the service, so the rules and audit rows apply. A revoked membership is granted then revoked. */
async function grantMembership(services: Services, actor: Actor, personId: string, state: MembershipState, year: number): Promise<number> {
  if (state === 'none') return 0;
  const startsOn = state === 'expired' ? `${year - 1}-01-01` : `${year}-01-01`;
  const endsOn = state === 'expired' ? `${year - 1}-12-31` : `${year + 1}-12-31`;
  const membership = await services.memberships.add(actor, { personId, plan: 'Season pass', startsOn, endsOn });
  if (state === 'revoked') await services.memberships.revoke(actor, { membershipId: membership.id, reason: 'Refunded after a cancelled booking' });
  return 1;
}

/** Links a guardian's pickup flag once they are in the household (the household link refuses pickup without guardian). */
async function setPickup(services: Services, actor: Actor, householdId: string, personId: string, guardian: RosterGuardian): Promise<void> {
  if (!guardian.canPickup) return;
  await services.people.linkToHousehold(actor, { householdId, personId, relationship: 'Parent', isGuardian: true, canPickup: true });
}

async function addFamily(services: Services, actor: Actor, family: RosterFamily, year: number, counts: RosterCounts) {
  const [first, ...others] = family.guardians;
  const primary = await services.people.create(actor, {
    givenName: first.givenName, familyName: family.surname, email: first.email, roles: ['guardian'],
    newHouseholdName: `${family.surname} family`, relationship: 'Parent',
  });
  counts.households++;
  const householdId = (await services.people.get(actor, primary.id)).households[0].id;
  await setPickup(services, actor, householdId, primary.id, first);
  const guardianIds = [primary.id];
  for (const guardian of others) {
    const person = await services.people.create(actor, {
      givenName: guardian.givenName, familyName: family.surname, email: guardian.email, roles: ['guardian'], householdId, relationship: 'Parent',
    });
    await setPickup(services, actor, householdId, person.id, guardian);
    guardianIds.push(person.id);
  }
  const campers: string[] = [];
  for (const camper of family.campers) {
    const personId = await addCamper(services, actor, householdId, camper);
    campers.push(personId);
    counts.memberships += await grantMembership(services, actor, personId, camper.membership, year);
  }
  for (const [index, guardian] of family.guardians.entries()) {
    counts.memberships += await grantMembership(services, actor, guardianIds[index], guardian.membership, year);
  }
  return { primaryId: primary.id, guardianIds, campers, counts };
}

async function addCamper(services: Services, actor: Actor, householdId: string, camper: RosterCamper): Promise<string> {
  const person = await services.people.create(actor, {
    givenName: camper.givenName, familyName: camper.familyName, dateOfBirth: camper.dateOfBirth, roles: ['camper'], householdId, relationship: 'Child',
  });
  return person.id;
}

/**
 * Families, then the adults without a household, then memberships and badges. Returns the ids the visit script needs.
 * Badges go to campers and guardians only, through the service, so each token is shown once and stored as a hash.
 */
export async function seedRoster(services: Services, actor: Actor, year: number): Promise<{ ids: RosterIds; counts: RosterCounts }> {
  const counts: RosterCounts = { people: 0, households: 0, memberships: 0, badges: 0 };
  const ids: RosterIds = { campers: [], primaryGuardians: [], adults: {} };
  const badgeHolders: string[] = [];
  for (const family of families()) {
    const added = await addFamily(services, actor, family, year, counts);
    ids.campers.push(...added.campers);
    ids.primaryGuardians.push(added.primaryId);
    badgeHolders.push(...added.guardianIds, ...added.campers);
    counts.people += added.guardianIds.length + added.campers.length;
  }
  for (const adult of ADULTS) {
    const person = await services.people.create(actor, {
      givenName: adult.givenName, familyName: adult.familyName, email: adult.email, roles: adult.roles,
    });
    ids.adults[adult.givenName] = person.id;
    counts.people++;
    counts.memberships += await grantMembership(services, actor, person.id, adult.membership, year);
  }
  for (const personId of badgeHolders) {
    await services.credentials.issue(actor, personId);
    counts.badges++;
  }
  return { ids, counts };
}
