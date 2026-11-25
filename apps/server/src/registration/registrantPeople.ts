import type { Actor } from '@buxa/domain';
import type { Person } from '@buxa/contracts';
import { isHttpError } from '../http/errors';
import type { PeopleService } from '../services/people/PeopleService';
import type { CamperRecord } from '@buxa/shared';

/** The people calls a registration makes: read a child and a guardian, update a guardian, add one. A test can supply just these. */
export type RegistrantPeople = Pick<PeopleService, 'get' | 'update' | 'create'>;

/*
 * The child a registration is recorded for, read from the person record by the server. The form never supplies these: the camper's
 * name and date of birth, and the parent or guardian on file, come from People. Saving a parent or guardian who is not on file goes
 * through the people service, so the people rules (roles, households, audit) still apply.
 */

/** A camper as the server reads them, with the household and guardian ids a save needs. */
export interface CamperOnFile extends CamperRecord {
  householdId: string | null;
  /** The household's guardian (the person to update), or null when the household has none. */
  guardianId: string | null;
}

/** The parent or guardian details a registration saved, split into the person's own names. */
export interface ParentSave {
  givenName: string;
  familyName: string;
  email: string | null;
  phone: string;
}

/**
 * The camper with this id, or null when there is no such person or they are not a camper (the registration then refuses the
 * child). Needs people:read, as the registration's staff have.
 */
export async function readCamper(
  people: RegistrantPeople,
  actor: Actor,
  camperId: string,
): Promise<CamperOnFile | null> {
  let person: Person;
  try {
    person = await people.get(actor, camperId);
  } catch (error) {
    if (isHttpError(error) && error.statusCode === 404) {
      return null;
    }

    throw error;
  }
  if (!person.roles.includes('camper') || person.archived) {
    return null;
  }

  const household = person.households[0] ?? null;
  const guardian = household?.members.find(m => m.personId !== person.id && m.isGuardian === true) ?? null;
  let parent: CamperRecord['parent'] = null;
  if (guardian) {
    const found = await people.get(actor, guardian.personId);
    parent = { name: `${found.givenName} ${found.familyName}`, email: found.email, phone: found.phone };
  }

  return {
    id: person.id,
    name: `${person.givenName} ${person.familyName}`,
    givenName: person.givenName,
    familyName: person.familyName,
    dateOfBirth: person.dateOfBirth,
    parent,
    householdId: household?.id ?? null,
    guardianId: guardian?.personId ?? null,
  };
}

/**
 * Saves a parent or guardian to the camper's household: updates the guardian on file, or adds one when the household has none. Used
 * only when the parent was not on file, after the registration is recorded. Needs people:update (and people:create for a new one).
 */
export async function saveParent(
  people: RegistrantPeople,
  actor: Actor,
  camper: CamperOnFile,
  parent: ParentSave,
): Promise<void> {
  if (camper.guardianId !== null) {
    await people.update(actor, camper.guardianId, {
      givenName: parent.givenName,
      familyName: parent.familyName,
      email: parent.email,
      phone: parent.phone,
    });

    return;
  }
  if (camper.householdId === null) {
    throw new Error('A camper with no household cannot save a parent or guardian.');
  }
  await people.create(actor, {
    givenName: parent.givenName,
    familyName: parent.familyName,
    roles: ['guardian'],
    email: parent.email ?? undefined,
    phone: parent.phone,
    householdId: camper.householdId,
    relationship: 'Parent',
  });
}
