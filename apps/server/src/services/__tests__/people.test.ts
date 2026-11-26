import { describe, expect, it } from 'vitest';
import { PHONE_NUMBER_MESSAGE, type NewPersonInput } from '@buxa/contracts';
import { createCamp, thrown, type Camp } from './support';

const adult = (givenName: string, familyName: string, extra: Partial<NewPersonInput> = {}): NewPersonInput => ({
  givenName,
  familyName,
  roles: ['participant'],
  dateOfBirth: '1985-06-15',
  phone: '+1 555 0100',
  ...extra,
});

/** A guardian with a new household, created as an admin would. */
async function guardianWithHousehold(camp: Camp, name: string, household = 'Lee family') {
  const admin = camp.actor('admin');

  return camp.people.create(admin, {
    dateOfBirth: '1985-06-15',
    phone: '+1 555 0100',
    givenName: name,
    familyName: 'Lee',
    roles: ['guardian'],
    newHouseholdName: household,
    relationship: 'Parent',
  });
}

describe('PeopleService permissions', () => {
  it('refuses a viewer every write and the household writes (403)', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const viewer = camp.actor('viewer');
    const ana = await camp.people.create(admin, adult('Ana', 'Lee', { roles: ['guardian'] }));
    const household = await camp.people.createHousehold(admin, { name: 'Lee family' });

    expect((await thrown(() => camp.people.create(viewer, adult('New', 'Person')))).statusCode).toBe(403);
    expect((await thrown(() => camp.people.update(viewer, ana.id, { givenName: 'X' }))).statusCode).toBe(403);
    expect((await thrown(() => camp.people.archive(viewer, ana.id))).statusCode).toBe(403);
    expect((await thrown(() => camp.people.createHousehold(viewer, { name: 'Other' }))).statusCode).toBe(403);
    expect(
      (
        await thrown(() =>
          camp.people.linkToHousehold(viewer, {
            householdId: household.id,
            personId: ana.id,
            relationship: 'Parent',
            isGuardian: true,
            canPickup: false,
          }),
        )
      ).statusCode,
    ).toBe(403);
    expect((await thrown(() => camp.people.unlinkFromHousehold(viewer, household.id, ana.id))).statusCode).toBe(403);
  });

  it('refuses staff archive, which needs people:delete (403)', async () => {
    const camp = await createCamp();
    const ana = await camp.people.create(camp.actor('admin'), adult('Ana', 'Lee'));
    expect((await thrown(() => camp.people.archive(camp.actor('staff'), ana.id))).statusCode).toBe(403);
  });

  it('lets a viewer read the list, a person and households', async () => {
    const camp = await withFixtures(await createCamp());
    expect((await camp.people.list(camp.actor('viewer'))).length).toBeGreaterThan(0);
    expect((await camp.people.listHouseholds(camp.actor('viewer'))).length).toBe(1);
  });
});

/** The fixture people for these tests: a guardian in one household and an adult with contact details. */
async function withFixtures(camp: Camp): Promise<Camp> {
  await guardianWithHousehold(camp, 'Ana');
  await camp.people.create(
    camp.actor('admin'),
    adult('Ben', 'Stone', { dateOfBirth: '1990-04-02', email: 'ben@example.org', phone: '+44 7700 900123' }),
  );

  return camp;
}

describe('PeopleService redaction', () => {
  it('withholds date of birth, email and phone from viewers, and shows them to staff', async () => {
    const camp = await withFixtures(await createCamp());
    const ben = (await camp.people.list(camp.actor('admin'), { query: 'Ben' }))[0];

    const asViewer = await camp.people.get(camp.actor('viewer'), ben.id);
    expect(asViewer.dateOfBirth).toBeNull();
    expect(asViewer.email).toBeNull();
    expect(asViewer.phone).toBeNull();
    expect(asViewer.givenName).toBe('Ben');
    expect(asViewer.roles).toEqual(['participant']);

    const asStaff = await camp.people.get(camp.actor('staff'), ben.id);
    expect(asStaff.dateOfBirth).toBe('1990-04-02');
    expect(asStaff.email).toBe('ben@example.org');
    expect(asStaff.phone).toBe('+44 7700 900123');
  });

  it('withholds the minor flag from viewers, and gives staff the computed value', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const guardian = await guardianWithHousehold(camp, 'Ana');
    const household = (await camp.people.get(admin, guardian.id)).households[0];
    const kim = await camp.people.create(admin, {
      phone: '+1 555 0100',
      givenName: 'Kim',
      familyName: 'Lee',
      roles: ['camper'],
      householdId: household.id,
      relationship: 'Child',
      dateOfBirth: '2015-03-01',
    });

    expect((await camp.people.get(camp.actor('viewer'), kim.id)).isMinor).toBeNull();
    expect((await camp.people.get(camp.actor('staff'), kim.id)).isMinor).toBe(true);
    expect((await camp.people.get(camp.actor('viewer'), guardian.id)).isMinor).toBeNull();
  });

  it('gives a viewer a null minor flag even for a person with no birth date (no inference leaks)', async () => {
    const camp = await createCamp();
    const ben = await camp.people.create(camp.actor('admin'), adult('Ben', 'Stone'));
    expect((await camp.people.get(camp.actor('viewer'), ben.id)).isMinor).toBeNull();
    expect((await camp.people.get(camp.actor('staff'), ben.id)).isMinor).toBe(false);
  });

  it('keeps contact details out of the list rows for everyone', async () => {
    const camp = await withFixtures(await createCamp());
    const rows = await camp.people.list(camp.actor('staff'));
    for (const row of rows) {
      expect(Object.keys(row)).not.toContain('email');
    }
  });
});

describe('PeopleService household rules', () => {
  it('refuses a camper with no household (400)', async () => {
    const camp = await createCamp();
    const error = await thrown(() =>
      camp.people.create(camp.actor('staff'), {
        dateOfBirth: '2012-06-15',
        phone: '+1 555 0100',
        givenName: 'Kim',
        familyName: 'Lee',
        roles: ['camper'],
        relationship: 'Child',
      }),
    );
    expect(error.statusCode).toBe(400);
  });

  it('refuses a camper whose household has no guardian (400)', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const household = await camp.people.createHousehold(admin, { name: 'Empty' });
    const error = await thrown(() =>
      camp.people.create(admin, {
        dateOfBirth: '2012-06-15',
        phone: '+1 555 0100',
        givenName: 'Kim',
        familyName: 'Lee',
        roles: ['camper'],
        householdId: household.id,
        relationship: 'Child',
      }),
    );
    expect(error.statusCode).toBe(400);
  });

  it('refuses a camper in a new household, and leaves no household behind', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const error = await thrown(() =>
      camp.people.create(admin, {
        dateOfBirth: '2012-06-15',
        phone: '+1 555 0100',
        givenName: 'Kim',
        familyName: 'Lee',
        roles: ['camper'],
        newHouseholdName: 'Lee family',
        relationship: 'Child',
      }),
    );
    expect(error.statusCode).toBe(400);
    expect(await camp.repos.people.listHouseholds('user-admin', camp.orgId)).toEqual([]);
    expect(await camp.repos.people.list('user-admin', camp.orgId, {})).toEqual([]);
  });

  it('adds a camper to a household that has a guardian', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const guardian = await guardianWithHousehold(camp, 'Ana');
    const household = (await camp.people.get(admin, guardian.id)).households[0];
    const kim = await camp.people.create(admin, {
      phone: '+1 555 0100',
      givenName: 'Kim',
      familyName: 'Lee',
      roles: ['camper'],
      householdId: household.id,
      relationship: 'Child',
      dateOfBirth: '2015-03-01',
    });
    expect(kim.isMinor).toBe(true);
    const link = (await camp.people.getHousehold(admin, household.id)).members.find(m => m.personId === kim.id);
    expect(link?.isGuardian).toBe(false);
  });

  it('infers the guardian flag from the guardian role when a person joins a household', async () => {
    const camp = await createCamp();
    const guardian = await guardianWithHousehold(camp, 'Ana');
    const household = (await camp.people.get(camp.actor('admin'), guardian.id)).households[0];
    expect(household.members.find(m => m.personId === guardian.id)).toMatchObject({
      isGuardian: true,
      canPickup: false,
      relationship: 'Parent',
    });
  });

  it('refuses canPickup without isGuardian when linking (400)', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const household = await camp.people.createHousehold(admin, { name: 'Lee family' });
    const ben = await camp.people.create(admin, adult('Ben', 'Stone'));
    const error = await thrown(() =>
      camp.people.linkToHousehold(admin, {
        householdId: household.id,
        personId: ben.id,
        relationship: 'Uncle',
        isGuardian: false,
        canPickup: true,
      }),
    );
    expect(error.statusCode).toBe(400);
  });

  it("refuses unlinking a camper's last guardian (409), and allows it once no camper depends on them", async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const guardian = await guardianWithHousehold(camp, 'Ana');
    const household = (await camp.people.get(admin, guardian.id)).households[0];
    await camp.people.create(admin, {
      dateOfBirth: '2012-06-15',
      phone: '+1 555 0100',
      givenName: 'Kim',
      familyName: 'Lee',
      roles: ['camper'],
      householdId: household.id,
      relationship: 'Child',
    });

    const refused = await thrown(() => camp.people.unlinkFromHousehold(admin, household.id, guardian.id));
    expect(refused.statusCode).toBe(409);

    const kim = (await camp.people.list(admin, { query: 'Kim' }))[0];
    const remaining = await camp.people.unlinkFromHousehold(admin, household.id, kim.id);
    expect(remaining.members.map(m => m.personId)).toContain(guardian.id);
  });

  it('lists households by name, with member names resolved', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    await camp.people.createHousehold(admin, { name: 'Zeta house' });
    await guardianWithHousehold(camp, 'Ana', 'Alpha house');
    const households = await camp.people.listHouseholds(admin);
    expect(households.map(h => h.name)).toEqual(['Alpha house', 'Zeta house']);
    expect(households[0].members[0]).toMatchObject({ givenName: 'Ana', familyName: 'Lee', isGuardian: true });
  });
});

describe('PeopleService edit: household and email', () => {
  it('moves a camper to the chosen household, which has a guardian, and out of the one they left', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const ana = await guardianWithHousehold(camp, 'Ana', 'Alpha house');
    const alpha = (await camp.people.get(admin, ana.id)).households[0];
    const ben = await guardianWithHousehold(camp, 'Ben', 'Beta house');
    const beta = (await camp.people.get(admin, ben.id)).households[0];
    const kim = await camp.people.create(admin, {
      dateOfBirth: '2012-06-15',
      phone: '+1 555 0100',
      givenName: 'Kim',
      familyName: 'Lee',
      roles: ['camper'],
      householdId: alpha.id,
      relationship: 'Child',
    });

    await camp.people.setHousehold(admin, kim.id, { householdId: beta.id, relationship: 'Child' }, ['camper']);

    const after = await camp.people.get(admin, kim.id);
    expect(after.households.map(h => h.id)).toEqual([beta.id]);
    expect((await camp.people.getHousehold(admin, alpha.id)).members.map(m => m.personId)).toEqual([ana.id]);
  });

  it('creates a new household with the name given and links the person to it', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const guardian = await guardianWithHousehold(camp, 'Ana', 'Alpha house');
    const ben = await camp.people.create(admin, adult('Ben', 'Stone', { roles: ['guardian'] }));

    await camp.people.setHousehold(admin, ben.id, { newHouseholdName: 'Stone house', relationship: 'Partner' }, [
      'guardian',
    ]);

    const households = (await camp.people.get(admin, ben.id)).households;
    expect(households.map(h => h.name)).toEqual(['Stone house']);
    expect(households[0].members.find(m => m.personId === ben.id)).toMatchObject({ relationship: 'Partner' });
    expect((await camp.people.get(admin, guardian.id)).households[0].name).toBe('Alpha house');
  });

  it('refuses a camper a new household (400), and leaves the household they are in', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const guardian = await guardianWithHousehold(camp, 'Ana');
    const household = (await camp.people.get(admin, guardian.id)).households[0];
    const kim = await camp.people.create(admin, {
      dateOfBirth: '2012-06-15',
      phone: '+1 555 0100',
      givenName: 'Kim',
      familyName: 'Lee',
      roles: ['camper'],
      householdId: household.id,
      relationship: 'Child',
    });

    const refused = await thrown(() =>
      camp.people.setHousehold(admin, kim.id, { newHouseholdName: 'Kim house', relationship: 'Child' }, ['camper']),
    );
    expect(refused.statusCode).toBe(400);
    expect((await camp.people.get(admin, kim.id)).households.map(h => h.id)).toEqual([household.id]);
  });

  it('refuses to unlink a camper from their household (400), since they would have no guardian', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const guardian = await guardianWithHousehold(camp, 'Ana');
    const household = (await camp.people.get(admin, guardian.id)).households[0];
    const kim = await camp.people.create(admin, {
      dateOfBirth: '2012-06-15',
      phone: '+1 555 0100',
      givenName: 'Kim',
      familyName: 'Lee',
      roles: ['camper'],
      householdId: household.id,
      relationship: 'Child',
    });

    const refused = await thrown(() => camp.people.setHousehold(admin, kim.id, {}, ['camper']));
    expect(refused.statusCode).toBe(400);
    expect((await camp.people.get(admin, kim.id)).households.map(h => h.id)).toEqual([household.id]);
  });

  it('refuses to unlink a guardian whose camper would be left without one (409)', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const guardian = await guardianWithHousehold(camp, 'Ana');
    const household = (await camp.people.get(admin, guardian.id)).households[0];
    await camp.people.create(admin, {
      dateOfBirth: '2012-06-15',
      phone: '+1 555 0100',
      givenName: 'Kim',
      familyName: 'Lee',
      roles: ['camper'],
      householdId: household.id,
      relationship: 'Child',
    });

    const refused = await thrown(() => camp.people.setHousehold(admin, guardian.id, {}, ['guardian']));
    expect(refused.statusCode).toBe(409);
    expect((await camp.people.get(admin, guardian.id)).households.map(h => h.id)).toEqual([household.id]);
  });

  it('a failing person update leaves the household as it was (the household change is undone)', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const ana = await guardianWithHousehold(camp, 'Ana', 'Alpha house');
    const alpha = (await camp.people.get(admin, ana.id)).households[0];
    const ben = await guardianWithHousehold(camp, 'Ben', 'Beta house');
    const beta = (await camp.people.get(admin, ben.id)).households[0];
    const kim = await camp.people.create(admin, {
      dateOfBirth: '2012-06-15',
      phone: '+1 555 0100',
      givenName: 'Kim',
      familyName: 'Lee',
      roles: ['camper'],
      householdId: alpha.id,
      relationship: 'Child',
    });

    // An empty role set is refused by the details step (400), after the household has already moved.
    const refused = await thrown(() =>
      camp.people.updateWithHousehold(admin, kim.id, { roles: [] }, { householdId: beta.id, relationship: 'Child' }),
    );
    expect(refused.statusCode).toBe(400);
    expect((await camp.people.get(admin, kim.id)).households.map(h => h.id)).toEqual([alpha.id]);
  });

  it('a successful edit changes the details and the household together', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const ana = await guardianWithHousehold(camp, 'Ana', 'Alpha house');
    const alpha = (await camp.people.get(admin, ana.id)).households[0];
    const ben = await guardianWithHousehold(camp, 'Ben', 'Beta house');
    const beta = (await camp.people.get(admin, ben.id)).households[0];
    const kim = await camp.people.create(admin, {
      dateOfBirth: '2012-06-15',
      phone: '+1 555 0100',
      givenName: 'Kim',
      familyName: 'Lee',
      roles: ['camper'],
      householdId: alpha.id,
      relationship: 'Child',
    });

    const updated = await camp.people.updateWithHousehold(
      admin,
      kim.id,
      { givenName: 'Kimberly' },
      { householdId: beta.id, relationship: 'Child' },
    );

    expect(updated.givenName).toBe('Kimberly');
    expect(updated.households.map(h => h.id)).toEqual([beta.id]);
  });

  it('the guardian rule still refuses an unsafe household change, and the details are not saved', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const guardian = await guardianWithHousehold(camp, 'Ana', 'Alpha house');
    const household = (await camp.people.get(admin, guardian.id)).households[0];
    const kim = await camp.people.create(admin, {
      dateOfBirth: '2012-06-15',
      phone: '+1 555 0100',
      givenName: 'Kim',
      familyName: 'Lee',
      roles: ['camper'],
      householdId: household.id,
      relationship: 'Child',
    });

    const refused = await thrown(() =>
      camp.people.updateWithHousehold(
        admin,
        kim.id,
        { givenName: 'Kimberly' },
        { newHouseholdName: 'Kim house', relationship: 'Child' },
      ),
    );
    expect(refused.statusCode).toBe(400);
    const after = await camp.people.get(admin, kim.id);
    expect(after.givenName).toBe('Kim');
    expect(after.households.map(h => h.id)).toEqual([household.id]);
  });

  it('saves the one email on the person, which staff then read back', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const ben = await camp.people.create(admin, adult('Ben', 'Stone', { roles: ['guardian'] }));

    const updated = await camp.people.update(admin, ben.id, { email: 'household@example.org' });

    expect(updated.email).toBe('household@example.org');
    expect((await camp.people.get(camp.actor('staff'), ben.id)).email).toBe('household@example.org');
  });
});

describe('PeopleService lifecycle', () => {
  it('refuses to archive someone who is on site (409), then archives and revokes the badge', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const ben = await camp.people.create(admin, adult('Ben', 'Stone'));
    await camp.memberships.add(admin, {
      personId: ben.id,
      plan: 'Summer',
      startsOn: '2027-07-01',
      endsOn: '2027-08-31',
    });
    await camp.credentials.issue(admin, ben.id);
    await camp.attendance.checkIn(admin, { personId: ben.id, method: 'manual' });

    expect((await thrown(() => camp.people.archive(admin, ben.id))).statusCode).toBe(409);

    const checkedOut = await camp.attendance.checkOut(admin, { personId: ben.id });
    expect(checkedOut.ok).toBe(true);
    await camp.people.archive(admin, ben.id);
    const archived = await camp.people.get(admin, ben.id);
    expect(archived.archived).toBe(true);
    expect(archived.hasActiveBadge).toBe(false);
  });

  it('rejects an empty role set (400) and unknown people (404)', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const ben = await camp.people.create(admin, adult('Ben', 'Stone'));
    expect((await thrown(() => camp.people.update(admin, ben.id, { roles: [] }))).statusCode).toBe(400);
    expect((await thrown(() => camp.people.get(admin, '00000000-0000-4000-8000-000000000000'))).statusCode).toBe(404);
  });

  it("keeps a person's own names and roles when only the contact details change", async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const ben = await camp.people.create(admin, adult('Ben', 'Stone'));
    const updated = await camp.people.update(admin, ben.id, { email: '  ' });
    expect(updated).toMatchObject({ givenName: 'Ben', familyName: 'Stone', email: null, roles: ['participant'] });
  });
});

describe('PeopleService email', () => {
  it('stores an email in lower case, on create and on update', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const ana = await camp.people.create(admin, adult('Ana', 'Lee', { email: 'Ana.Lee@Example.COM' }));
    expect(ana.email).toBe('ana.lee@example.com');
    const updated = await camp.people.update(admin, ana.id, { email: 'ANA@Example.com' });
    expect(updated.email).toBe('ana@example.com');
  });
});

describe('PeopleService date of birth and phone are required on every person', () => {
  it('refuses a person with no date of birth, with the same message as the form (400)', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const error = await thrown(() => camp.people.create(admin, adult('Ana', 'Lee', { dateOfBirth: '' })));
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Enter the date of birth.');
    const notADate = await thrown(() => camp.people.create(admin, adult('Ana', 'Lee', { dateOfBirth: '2012-02-31' })));
    expect(notADate.message).toBe('Use a real date (YYYY-MM-DD).');
  });

  it('refuses a person with no phone, with the phone message (400)', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const error = await thrown(() => camp.people.create(admin, adult('Ana', 'Lee', { phone: '' })));
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe(PHONE_NUMBER_MESSAGE);
  });

  it('refuses an edit that blanks the date of birth or the phone, and saves nothing', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const ana = await camp.people.create(admin, adult('Ana', 'Lee'));
    expect((await thrown(() => camp.people.update(admin, ana.id, { dateOfBirth: '' }))).message).toBe(
      'Enter the date of birth.',
    );
    expect((await thrown(() => camp.people.update(admin, ana.id, { phone: '' }))).message).toBe(PHONE_NUMBER_MESSAGE);
    const after = await camp.people.get(admin, ana.id);
    expect(after.dateOfBirth).toBe('1985-06-15');
    expect(after.phone).toBe('+1 555 0100');
  });

  it('saves a guardian with the date of birth and phone it was given', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const guardian = await camp.people.create(admin, adult('Ana', 'Lee', { roles: ['guardian'] }));
    expect(guardian.dateOfBirth).toBe('1985-06-15');
    expect(guardian.phone).toBe('+1 555 0100');
  });
});
