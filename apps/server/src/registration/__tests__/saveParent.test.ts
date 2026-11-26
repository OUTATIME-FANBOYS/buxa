import { describe, expect, it } from 'vitest';
import type { Actor } from '@buxa/domain';
import { readCamper, saveParent, saveParentDateOfBirth, type RegistrantPeople } from '../registrantPeople';
import { adaFixture, registrantPeople } from './registrantPeople';

const CAMPER = '5e6f7a8b-1111-4a2b-8c3d-4e5f6a7b8c9d';
const GUARDIAN = '5e6f7a8b-3333-4a2b-8c3d-4e5f6a7b8c9d';
type CreateInput = Parameters<RegistrantPeople['create']>[1];
const ACTOR: Actor = { userId: 'user-staff', orgId: '11111111-1111-4111-8111-111111111111', role: 'staff' };

describe('the parent or guardian saved with a registration carries a date of birth', () => {
  it('readCamper exposes the parent date of birth from the person record', async () => {
    const people = registrantPeople([
      {
        ...adaFixture(CAMPER, GUARDIAN),
        guardian: {
          id: GUARDIAN,
          givenName: 'Byron',
          familyName: 'Lovelace',
          email: null,
          phone: '555-0100',
          dateOfBirth: '1979-11-02',
        },
      },
    ]);
    const camper = await readCamper(people, ACTOR, CAMPER);
    expect(camper?.parent?.dateOfBirth).toBe('1979-11-02');
  });

  it('saveParent creates the guardian with the date of birth when the household has none', async () => {
    const people = registrantPeople([{ ...adaFixture(CAMPER, GUARDIAN), guardian: null }]);
    const camper = await readCamper(people, ACTOR, CAMPER);
    if (camper === null) {
      throw new Error('the camper should be on file');
    }
    const created: CreateInput[] = [];
    const recording: RegistrantPeople = {
      ...people,
      create: (actor, input) => {
        created.push(input);

        return people.create(actor, input);
      },
    };
    await saveParent(recording, ACTOR, camper, {
      givenName: 'Byron',
      familyName: 'Lovelace',
      email: 'byron@example.test',
      phone: '555-0100',
      dateOfBirth: '1979-11-02',
    });

    expect(created).toEqual([
      expect.objectContaining({
        givenName: 'Byron',
        familyName: 'Lovelace',
        phone: '555-0100',
        dateOfBirth: '1979-11-02',
      }),
    ]);
  });

  it('saveParent updates the guardian on file with the date of birth', async () => {
    const people = registrantPeople([adaFixture(CAMPER, GUARDIAN)]);
    const camper = await readCamper(people, ACTOR, CAMPER);
    if (camper === null) {
      throw new Error('the camper should be on file');
    }
    await saveParent(people, ACTOR, camper, {
      givenName: 'Byron',
      familyName: 'Lovelace',
      email: null,
      phone: '555-0199',
      dateOfBirth: '1979-11-02',
    });

    const after = await readCamper(people, ACTOR, CAMPER);
    expect(after?.parent).toMatchObject({ phone: '555-0199', dateOfBirth: '1979-11-02' });
  });

  it('saveParentDateOfBirth sets the date of birth on a parent on file without one, and keeps the rest', async () => {
    const people = registrantPeople([
      {
        ...adaFixture(CAMPER, GUARDIAN),
        guardian: {
          id: GUARDIAN,
          givenName: 'Byron',
          familyName: 'Lovelace',
          email: 'byron@example.test',
          phone: '555-0100',
          dateOfBirth: null,
        },
      },
    ]);
    const camper = await readCamper(people, ACTOR, CAMPER);
    if (camper === null) {
      throw new Error('the camper should be on file');
    }
    await saveParentDateOfBirth(people, ACTOR, camper, '1979-11-02');

    const after = await readCamper(people, ACTOR, CAMPER);
    expect(after?.parent).toEqual({
      name: 'Byron Lovelace',
      email: 'byron@example.test',
      phone: '555-0100',
      dateOfBirth: '1979-11-02',
    });
  });
});
