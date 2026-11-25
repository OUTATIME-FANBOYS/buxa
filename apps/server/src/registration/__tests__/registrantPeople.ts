import { randomUUID } from 'node:crypto';
import type { Person, Household, HouseholdMember } from '@buxa/contracts';
import { notFound } from '../../http/errors';
import type { RegistrantPeople } from '../registrantPeople';

/*
 * The people a registration reads (a child and the guardian on the child's household), served the way the people service returns
 * them. Registration tests give the children they name; the submit reads each child here, as it does in the app.
 */

export interface GuardianFixture {
  id: string;
  givenName: string;
  familyName: string;
  email: string | null;
  phone: string | null;
}

export interface ChildFixture {
  id: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string | null;
  /** The household's guardian, or none. A guardian with no phone is not on file (the form asks for the parent). */
  guardian: GuardianFixture | null;
}

function memberOf(
  person: Pick<Person, 'id' | 'givenName' | 'familyName' | 'roles'>,
  isGuardian: boolean,
): HouseholdMember {
  return {
    personId: person.id,
    givenName: person.givenName,
    familyName: person.familyName,
    roles: [...person.roles],
    relationship: isGuardian ? 'Parent' : 'Child',
    isGuardian,
    canPickup: false,
  };
}

function personOf(
  fields: Pick<Person, 'id' | 'givenName' | 'familyName' | 'roles' | 'dateOfBirth' | 'email' | 'phone' | 'households'>,
): Person {
  return {
    ...fields,
    status: null,
    onSite: null,
    archived: false,
    isMinor: null,
    memberships: null,
    hasActiveBadge: null,
    emergencyContact: null,
    canEditEmergencyContact: false,
  };
}

/**
 * A people lookup holding each child, their household and the guardian. `update` and `create` change the lookup's own records, so a
 * test can read back what the registration saved.
 */
export function registrantPeople(children: readonly ChildFixture[]): RegistrantPeople {
  const records = new Map<string, Person>();

  for (const child of children) {
    const household: Household = {
      id: `household-${child.id}`,
      name: `${child.givenName} household`,
      members: [],
    };
    const guardian = child.guardian;
    if (guardian) {
      const guardianRecord = personOf({
        id: guardian.id,
        givenName: guardian.givenName,
        familyName: guardian.familyName,
        roles: ['guardian'],
        dateOfBirth: null,
        email: guardian.email,
        phone: guardian.phone,
        households: [],
      });
      records.set(guardian.id, guardianRecord);
      household.members.push(memberOf(guardianRecord, true));
    }
    const childRecord = personOf({
      id: child.id,
      givenName: child.givenName,
      familyName: child.familyName,
      roles: ['camper'],
      dateOfBirth: child.dateOfBirth,
      email: null,
      phone: null,
      households: [household],
    });
    household.members.push(memberOf(childRecord, false));
    records.set(child.id, childRecord);
  }

  const find = (id: string): Person => {
    const found = records.get(id);
    if (!found) {
      throw notFound('Person not found');
    }

    return found;
  };

  return {
    get: (_actor, id) => Promise.resolve(find(id)),
    update: (_actor, id, patch) => {
      const current = find(id);
      const updated = personOf({
        ...current,
        givenName: patch.givenName ?? current.givenName,
        familyName: patch.familyName ?? current.familyName,
        email: patch.email === undefined ? current.email : patch.email,
        phone: patch.phone === undefined ? current.phone : patch.phone,
      });
      records.set(id, updated);

      return Promise.resolve(updated);
    },
    create: (_actor, input) => {
      const id = randomUUID();
      const created = personOf({
        id,
        givenName: input.givenName,
        familyName: input.familyName,
        roles: [...input.roles],
        dateOfBirth: input.dateOfBirth ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        households: [],
      });
      records.set(id, created);

      return Promise.resolve(created);
    },
  };
}

/** Ada Lovelace, aged 11 on the test dates, with a guardian who has no phone on file yet. */
export function adaFixture(id: string, guardianId: string): ChildFixture {
  return {
    id,
    givenName: 'Ada',
    familyName: 'Lovelace',
    dateOfBirth: '2014-03-09',
    guardian: { id: guardianId, givenName: 'Byron', familyName: 'Lovelace', email: null, phone: null },
  };
}

/** Ben Carrow, a second child, with a guardian who has no phone on file yet. */
export function benFixture(id: string, guardianId: string): ChildFixture {
  return {
    id,
    givenName: 'Ben',
    familyName: 'Carrow',
    dateOfBirth: '2013-05-01',
    guardian: { id: guardianId, givenName: 'Mira', familyName: 'Carrow', email: null, phone: null },
  };
}
