import { describe, expect, it } from 'vitest';
import { createBadgeCipher, parseBadgeKey } from '../../credentials/badgeCipher';
import { camperIdsFor } from '../../__tests__/fakes';
import { createCredentialService } from '../../services/credentials/createCredentialService';
import { createCamp, TEST_BADGE_KEY, type Camp } from '../../services/__tests__/support';
import { InMemoryRegistrationRepository } from '../InMemoryRegistrationRepository';
import { createRegistrationService, type RegistrationService } from '../RegistrationService';

const SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';
const CLASS = 'cccccccc-0000-4000-8000-000000000001';
const NOW = new Date('2027-07-10T12:00:00Z');

/** The registration service over the camp's in-memory store, with the badge step wired the way the runtime wires it. */
function registrationsFor(camp: Camp): RegistrationService {
  const repo = new InMemoryRegistrationRepository(
    { [camp.orgId]: [SESSION] },
    (orgId, answers) => camperIdsFor(camp.store.database, orgId, answers),
    camp.repos.credentials,
    {
      [camp.orgId]: [
        {
          classId: CLASS,
          sessionId: SESSION,
          className: 'Archery',
          startsAt: '2027-07-10T10:00:00.000Z',
          endsAt: '2027-07-10T11:00:00.000Z',
        },
      ],
    },
  );

  return createRegistrationService(repo, credentials =>
    createCredentialService({
      credentials,
      people: camp.repos.people,
      memberships: camp.repos.memberships,
      attendance: camp.repos.attendance,
      orgs: camp.repos.orgs,
      clock: () => new Date(NOW),
      cipher: createBadgeCipher(() => parseBadgeKey(TEST_BADGE_KEY)),
    }),
  );
}

/** A camper born 2014-03-09 and a form with one pending registration that names her. */
async function pendingRegistration(camp: Camp, service: RegistrationService) {
  const admin = camp.actor('admin');
  const guardian = await camp.people.create(admin, {
    givenName: 'Byron',
    familyName: 'Lovelace',
    roles: ['guardian'],
    newHouseholdName: 'Lovelace family',
    relationship: 'Parent',
  });
  const [household] = await camp.repos.people.householdsOf(admin.userId, camp.orgId, guardian.id);
  const camper = await camp.people.create(admin, {
    givenName: 'Ada',
    familyName: 'Lovelace',
    dateOfBirth: '2014-03-09',
    roles: ['camper'],
    householdId: household.id,
    relationship: 'Child',
  });
  const form = await service.createForm(admin, {
    name: 'Summer 2027',
    season: 'Summer',
    sessionIds: [SESSION],
    fields: [],
  });
  await service.publishForm(admin, form.id);
  const id = await service.submit(camp.actor('staff'), form.id, submissionFor(form.id, camper.id));

  return { id, formId: form.id, camperId: camper.id };
}

function submissionFor(formId: string, camperId: string) {
  return {
    formId,
    selections: [{ camperId, classId: CLASS }],
    standard: {
      camperFirstName: 'Ada',
      camperLastName: 'Lovelace',
      camperBirthDate: '2014-03-09',
      guardianName: 'Byron Lovelace',
      guardianPhone: '555-0100',
      emergencyContactName: 'Mary Somerville',
      emergencyContactPhone: '555-0111',
    },
    custom: {},
  };
}

const issuedCount = (camp: Camp) => camp.audit().filter(a => a.action === 'credential.issue').length;

describe('confirming a registration issues badges for its campers', () => {
  it('confirming a registration with a camper issues one encrypted badge', async () => {
    const camp = await createCamp();
    const service = registrationsFor(camp);
    const { id, camperId } = await pendingRegistration(camp, service);

    const outcome = await service.confirm(camp.actor('admin'), id);

    expect(outcome).toEqual({ badgesIssued: 1, badgeNote: null });
    expect(issuedCount(camp)).toBe(1);
    const active = await camp.repos.credentials.withActive(camp.actor('admin').userId, camp.orgId, [camperId]);
    expect(active.has(camperId)).toBe(true);
    // The encrypted copy opens with the test key: a reprint shows the payload rather than asking for a reissue.
    expect(await camp.credentials.reprint(camp.actor('admin'), camperId)).toMatchObject({ kind: 'shown' });
  });

  it('a second confirmation for the same camper does not issue another badge', async () => {
    const camp = await createCamp();
    const service = registrationsFor(camp);
    const first = await pendingRegistration(camp, service);
    await service.confirm(camp.actor('admin'), first.id);

    const secondId = await service.submit(
      camp.actor('staff'),
      first.formId,
      submissionFor(first.formId, first.camperId),
    );
    const outcome = await service.confirm(camp.actor('admin'), secondId);

    expect(outcome).toEqual({ badgesIssued: 0, badgeNote: null });
    expect(issuedCount(camp)).toBe(1);
  });

  it('a staff confirmer confirms, issues no badge, and gets a note that an admin must issue them', async () => {
    const camp = await createCamp();
    const service = registrationsFor(camp);
    const { id, camperId } = await pendingRegistration(camp, service);

    const outcome = await service.confirm(camp.actor('staff'), id);

    expect(outcome).toEqual({ badgesIssued: 0, badgeNote: 'Badges for 1 camper need issuing by an admin.' });
    expect(issuedCount(camp)).toBe(0);
    const active = await camp.repos.credentials.withActive(camp.actor('admin').userId, camp.orgId, [camperId]);
    expect(active.size).toBe(0);
  });
});
