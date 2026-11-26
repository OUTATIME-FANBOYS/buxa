import { describe, expect, it } from 'vitest';
import { EmergencyContactInputSchema } from '@buxa/contracts';
import { emergencyContactComplete } from '@buxa/domain';
import { isHttpError } from '../../http/errors';
import { createCamp, type Camp } from './support';

/*
 * The emergency contact on a person. Staff (people:update) may change it; the family's guardian may change their child's; nobody
 * else may, and another family's guardian is refused. Each save is audited with the person id and no personal data.
 */

const CONTACT = { name: 'Mara Lee', phone: '+1 555 0100', relationship: 'Mother' };
const GUARDIAN_EMAIL = 'viewer@example.org';
const OTHER_GUARDIAN_EMAIL = 'other.parent@example.org';

async function build(): Promise<{
  camp: Camp;
  admin: ReturnType<Camp['actor']>;
  staff: ReturnType<Camp['actor']>;
  viewer: ReturnType<Camp['actor']>;
  kimId: string;
}> {
  const camp = await createCamp('UTC', '2027-07-10T09:00:00Z');
  const admin = camp.actor('admin');
  // The viewer's login is viewer@example.org (see createCamp). Its person is the guardian of the Viewer family.
  const guardian = await camp.people.create(admin, {
    dateOfBirth: '1985-06-15',
    phone: '+1 555 0100',
    givenName: 'Vee',
    familyName: 'Viewer',
    roles: ['guardian'],
    email: GUARDIAN_EMAIL,
    newHouseholdName: 'Viewer family',
    relationship: 'Mother',
  });
  const householdId = (await camp.people.get(admin, guardian.id)).households[0].id;
  const kim = await camp.people.create(admin, {
    phone: '+1 555 0100',
    givenName: 'Kim',
    familyName: 'Viewer',
    roles: ['camper'],
    householdId,
    relationship: 'Child',
    dateOfBirth: '2015-03-01',
  });
  // Another family, with its own guardian and no link to Kim.
  await camp.people.create(admin, {
    dateOfBirth: '1985-06-15',
    phone: '+1 555 0100',
    givenName: 'Olu',
    familyName: 'Other',
    roles: ['guardian'],
    email: OTHER_GUARDIAN_EMAIL,
    newHouseholdName: 'Other family',
    relationship: 'Father',
  });

  return {
    camp,
    admin,
    staff: camp.actor('staff'),
    viewer: camp.actor('viewer'),
    kimId: kim.id,
  };
}

const refusedWith403 = async (run: () => Promise<unknown>): Promise<void> => {
  const error = await run().then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(isHttpError(error)).toBe(true);
  if (isHttpError(error)) {
    expect(error.statusCode).toBe(403);
  }
};

describe('emergency contact: who may change it', () => {
  it('lets staff change any person’s contact', async () => {
    const { camp, staff, kimId } = await build();
    await camp.people.updateEmergencyContact(staff, kimId, CONTACT, 'staff@example.org');
    const kim = await camp.people.get(staff, kimId, 'staff@example.org');
    expect(kim.emergencyContact).toEqual(CONTACT);
  });

  it('lets the family’s guardian change their child’s contact, recognised by the signed-in email', async () => {
    const { camp, viewer, kimId } = await build();
    await camp.people.updateEmergencyContact(viewer, kimId, CONTACT, GUARDIAN_EMAIL);
    const seen = await camp.people.get(viewer, kimId, GUARDIAN_EMAIL);
    expect(seen.emergencyContact).toEqual(CONTACT);
    expect(seen.canEditEmergencyContact).toBe(true);
  });

  it('refuses another family’s guardian, who has no link to the child', async () => {
    const { camp, viewer, kimId } = await build();
    await refusedWith403(() => camp.people.updateEmergencyContact(viewer, kimId, CONTACT, OTHER_GUARDIAN_EMAIL));
  });

  it('refuses a viewer with no family link at all', async () => {
    const { camp, viewer, kimId } = await build();
    await refusedWith403(() => camp.people.updateEmergencyContact(viewer, kimId, CONTACT, 'stranger@example.org'));
  });

  it('refuses the guardian once the camp is archived (reads only)', async () => {
    const { camp, viewer, kimId } = await build();
    await refusedWith403(() =>
      camp.people.updateEmergencyContact({ ...viewer, archived: true }, kimId, CONTACT, GUARDIAN_EMAIL),
    );
  });

  it('shows the contact to a viewer who is not the guardian as null, and no edit right', async () => {
    const { camp, admin, kimId } = await build();
    await camp.people.updateEmergencyContact(admin, kimId, CONTACT, 'admin@example.org');
    const seen = await camp.people.get(camp.actor('viewer'), kimId, OTHER_GUARDIAN_EMAIL);
    expect(seen.emergencyContact).toBeNull();
    expect(seen.canEditEmergencyContact).toBe(false);
  });

  it('clears the contact when name and phone are blank', async () => {
    const { camp, staff, kimId } = await build();
    await camp.people.updateEmergencyContact(staff, kimId, CONTACT, 'staff@example.org');
    await camp.people.updateEmergencyContact(
      staff,
      kimId,
      EmergencyContactInputSchema.parse({ name: '', phone: '', relationship: '' }),
      'staff@example.org',
    );
    const kim = await camp.people.get(staff, kimId, 'staff@example.org');
    expect(kim.emergencyContact).toEqual({ name: null, phone: null, relationship: null });
  });

  it('answers not found for an unknown person, after the permission check', async () => {
    const { camp, staff } = await build();
    const error = await camp.people
      .updateEmergencyContact(staff, '99999999-9999-4999-8999-999999999999', CONTACT, 'staff@example.org')
      .then(
        () => null,
        (caught: unknown) => caught,
      );
    expect(isHttpError(error) && error.statusCode).toBe(404);
  });
});

describe('emergency contact: audit', () => {
  it('writes a person.emergency_contact.update row for the person, with no personal data in it', async () => {
    const { camp, staff, kimId } = await build();
    await camp.people.updateEmergencyContact(staff, kimId, CONTACT, 'staff@example.org');
    const rows = camp.audit().filter(row => row.action === 'person.emergency_contact.update');
    expect(rows).toHaveLength(1);
    expect(rows[0].entityId).toBe(kimId);
    expect(rows[0].entity).toBe('person');
    const payload = JSON.stringify(rows[0].data);
    expect(payload).not.toContain('Mara');
    expect(payload).not.toContain('555');
    expect(payload).not.toContain('Mother');
  });

  it('writes no row for a refused change', async () => {
    const { camp, viewer, kimId } = await build();
    await refusedWith403(() => camp.people.updateEmergencyContact(viewer, kimId, CONTACT, OTHER_GUARDIAN_EMAIL));
    expect(camp.audit().some(row => row.action === 'person.emergency_contact.update')).toBe(false);
  });
});

describe('emergency contact: creation and the input rule', () => {
  it('saves a contact given when the person is added', async () => {
    const { camp, admin } = await build();
    const person = await camp.people.create(admin, {
      dateOfBirth: '1985-06-15',
      phone: '+1 555 0100',
      givenName: 'Zed',
      familyName: 'Lee',
      roles: ['participant'],
      emergencyContact: CONTACT,
    });
    expect(person.emergencyContact).toEqual(CONTACT);
  });

  it('saves no contact when the creation fields are blank', async () => {
    const { camp, admin } = await build();
    const person = await camp.people.create(admin, {
      givenName: 'Zed',
      familyName: 'Lee',
      roles: ['participant'],
      dateOfBirth: '1985-06-15',
      phone: '+1 555 0100',
      emergencyContact: { name: '', phone: '', relationship: '' },
    });
    // A person with no contact recorded is shown the blank view, as after a clear (see the test above).
    expect(person.emergencyContact).toEqual({ name: null, phone: null, relationship: null });
  });

  it('refuses a name without a phone, and a phone that is not a phone', () => {
    expect(EmergencyContactInputSchema.safeParse({ name: 'Mara', phone: '', relationship: '' }).success).toBe(false);
    expect(EmergencyContactInputSchema.safeParse({ name: 'Mara', phone: 'call me', relationship: '' }).success).toBe(
      false,
    );
    expect(
      EmergencyContactInputSchema.safeParse({ name: 'Mara', phone: '+1 555 0100', relationship: '' }).success,
    ).toBe(true);
  });
});

describe('emergencyContactComplete', () => {
  it('is true only when the name and the phone are both set', () => {
    expect(
      emergencyContactComplete({ emergencyContact: { name: 'Mara', phone: '+1 555 0100', relationship: null } }),
    ).toBe(true);
    expect(emergencyContactComplete({ emergencyContact: { name: 'Mara', phone: null, relationship: null } })).toBe(
      false,
    );
    expect(
      emergencyContactComplete({ emergencyContact: { name: '  ', phone: '+1 555 0100', relationship: null } }),
    ).toBe(false);
  });

  it('is false when the viewer may not see the contact', () => {
    expect(emergencyContactComplete({ emergencyContact: null })).toBe(false);
  });
});
