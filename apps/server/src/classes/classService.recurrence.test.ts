import { describe, expect, it } from 'vitest';
import type { ClassRuleInput, NewRecurringClassInput } from '@buxa/contracts';
import { isHttpError } from '../http/errors';
import { CAMPER_ADA, JULY_SESSION, as, monday9to12, robotics, setup } from './__tests__/fixtures';

const expect403 = async (p: Promise<unknown>) => {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(isHttpError(err) && err.statusCode).toBe(403);
};

/** A series of Monday mornings from 5 July 2027 in camp time (Sydney): three classes unless the test changes the rule. */
const series = (
  overrides: Partial<NewRecurringClassInput> = {},
  rule: Partial<ClassRuleInput> = {},
): NewRecurringClassInput => ({
  rule: {
    weekdays: [1],
    firstDate: '2027-07-05',
    startTime: '09:00',
    endTime: '12:00',
    end: { kind: 'count', count: 3 },
    ...rule,
  },
  name: 'Painting',
  ageRange: { minAge: 8, maxAge: 12 },
  capacity: 5,
  location: 'Studio',
  instructorIds: [],
  price: null,
  ...overrides,
});

async function newSession(service: ReturnType<typeof setup>['service']) {
  const session = await service.createSession(as('admin'), JULY_SESSION);
  if (!session.ok) {
    throw new Error(session.failure.message);
  }
  // A new session is a draft and takes no enrolments, so it goes live here.
  await service.publishSession(as('admin'), session.value.id);

  return session.value.id;
}

describe('recurring classes: permissions', () => {
  it('a viewer cannot create a series or change a session public, and an admin can', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);

    await expect403(service.addRecurringClasses(as('viewer'), sessionId, series()));
    await expect403(service.setSessionPublic(as('viewer'), sessionId, true));

    const made = await service.addRecurringClasses(as('admin'), sessionId, series());
    expect(made.ok).toBe(true);
  });
});

describe('recurring classes: writing a series', () => {
  it('writes one class per occurrence, each a normal class with its own enrolments', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);

    const made = await service.addRecurringClasses(as('admin'), sessionId, series());
    if (!made.ok) {
      throw new Error(made.failure.message);
    }
    expect(made.value.map(c => c.startsAt)).toEqual([
      '2027-07-04T23:00:00.000Z',
      '2027-07-11T23:00:00.000Z',
      '2027-07-18T23:00:00.000Z',
    ]);

    const [first, second] = made.value;
    const enrolled = await service.enrol(as('admin'), {
      classId: first.id,
      camperId: CAMPER_ADA,
      waitlistIfFull: false,
    });
    expect(enrolled.ok).toBe(true);
    const other = await service.enrol(as('admin'), { classId: second.id, camperId: CAMPER_ADA, waitlistIfFull: false });
    expect(other.ok).toBe(true);
    const listed = await service.listClasses(as('admin'), sessionId);
    if (!listed.ok) {
      throw new Error(listed.failure.message);
    }
    expect(listed.value.map(c => c.seatsTaken)).toEqual([1, 1, 0]);
  });

  it('refuses a series whose occurrence clashes with a class already in the camp, and writes nothing', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);
    await service.addClass(as('admin'), sessionId, { ...robotics, ...monday9to12 });

    const refused = await service.addRecurringClasses(
      as('admin'),
      sessionId,
      series({}, { end: { kind: 'count', count: 1 } }),
    );

    expect(refused.ok).toBe(false);
    if (refused.ok) {
      return;
    }
    expect(refused.failure.reason).toBe('class_clash');
    expect(refused.failure.message).toMatch(/clashes with Robotics/);
    const listed = await service.listClasses(as('admin'), sessionId);
    expect(listed.ok && listed.value).toHaveLength(1);
  });

  it('refuses an occurrence that falls outside the session dates, and writes nothing', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);

    const refused = await service.addRecurringClasses(
      as('admin'),
      sessionId,
      series({}, { end: { kind: 'until', date: '2027-08-30' } }),
    );

    expect(refused.ok).toBe(false);
    if (refused.ok) {
      return;
    }
    expect(refused.failure.reason).toBe('class_outside_session');
    const listed = await service.listClasses(as('admin'), sessionId);
    expect(listed.ok && listed.value).toEqual([]);
  });

  it('refuses an incomplete rule with a message the screen can show', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);

    const refused = await service.addRecurringClasses(as('admin'), sessionId, series({}, { weekdays: [] }));

    expect(refused.ok).toBe(false);
    if (refused.ok) {
      return;
    }
    expect(refused.failure.reason).toBe('recurrence_invalid');
    expect(refused.failure.message).toBe('Choose at least one day of the week.');
  });
});

describe('public sessions', () => {
  it('a session is private until an admin marks it public, and the flag is read back', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);

    const before = await service.getSession(as('viewer'), sessionId);
    expect(before.ok && before.value.isPublic).toBe(false);

    const made = await service.setSessionPublic(as('admin'), sessionId, true);
    expect(made.ok && made.value.isPublic).toBe(true);
  });
});
