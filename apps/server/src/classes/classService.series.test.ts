import { describe, expect, it } from 'vitest';
import type { NewSeriesInput } from '@buxa/contracts';
import { isHttpError } from '../http/errors';
import { CAMPER_ADA, JULY_SESSION, as, monday9to12, robotics, setup } from './__tests__/fixtures';

const expect403 = async (p: Promise<unknown>) => {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(isHttpError(err) && err.statusCode).toBe(403);
};

/** A series of Mondays from 5 July 2027 to 19 July 2027 in camp time (Sydney): three days, 9:00 to 12:00. */
const series = (overrides: Partial<NewSeriesInput> = {}): NewSeriesInput => ({
  name: 'Painting',
  ageRange: { minAge: 8, maxAge: 12 },
  capacity: 5,
  location: 'Studio',
  instructorIds: [],
  price: null,
  weekdays: [1],
  startsAt: '2027-07-05T09:00',
  endsAt: '2027-07-19T12:00',
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

describe('class series: permissions', () => {
  it('a viewer cannot create a series, and an admin can', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);

    await expect403(service.addSeries(as('viewer'), sessionId, series()));
    const made = await service.addSeries(as('admin'), sessionId, series());
    expect(made.ok).toBe(true);
  });
});

describe('class series: writing one series', () => {
  it('writes one series whose days are its occurrences, and lists it as one row', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);

    const made = await service.addSeries(as('admin'), sessionId, series());
    if (!made.ok) {
      throw new Error(made.failure.message);
    }
    expect(made.value).toMatchObject({ name: 'Painting', weekdays: [1], occurrenceCount: 3, firstDay: '2027-07-05' });
    expect(made.value).toMatchObject({ startTime: '09:00', endTime: '12:00', lastDay: '2027-07-19' });

    const listed = await service.listSeries(as('admin'), sessionId);
    expect(listed.ok && listed.value.map(s => s.name)).toEqual(['Painting']);
    const days = await service.listSeriesOccurrences(as('admin'), made.value.id);
    expect(days.ok && days.value.map(d => d.startsAt)).toEqual([
      '2027-07-04T23:00:00.000Z',
      '2027-07-11T23:00:00.000Z',
      '2027-07-18T23:00:00.000Z',
    ]);
  });

  it('one child enrolled once in a five-day series holds one place, not five', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);
    const made = await service.addSeries(
      as('admin'),
      sessionId,
      series({ weekdays: [1, 2, 3, 4, 5], startsAt: '2027-07-05T09:00', endsAt: '2027-07-09T12:00' }),
    );
    if (!made.ok) {
      throw new Error(made.failure.message);
    }
    expect(made.value.occurrenceCount).toBe(5);

    const enrolled = await service.enrol(as('admin'), {
      classId: made.value.anchorClassId,
      camperId: CAMPER_ADA,
      waitlistIfFull: false,
    });
    expect(enrolled.ok).toBe(true);

    const [listed] = await service.listSeries(as('admin'), sessionId).then(r => (r.ok ? r.value : []));
    expect(listed.seatsTaken).toBe(1);
    const again = await service.enrol(as('admin'), {
      classId: made.value.anchorClassId,
      camperId: CAMPER_ADA,
      waitlistIfFull: false,
    });
    expect(again.ok).toBe(false);
  });

  it('refuses a series whose day clashes with a class in the same location, and writes nothing', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);
    await service.addClass(as('admin'), sessionId, { ...robotics, ...monday9to12 });

    const refused = await service.addSeries(
      as('admin'),
      sessionId,
      series({ location: 'Lab 1', startsAt: '2027-07-05T09:00', endsAt: '2027-07-05T12:00' }),
    );

    expect(refused.ok).toBe(false);
    if (refused.ok) {
      return;
    }
    expect(refused.failure.reason).toBe('class_clash');
    expect(refused.failure.message).toMatch(/clashes with Robotics at Lab 1/);
    const listed = await service.listSeries(as('admin'), sessionId);
    expect(listed.ok && listed.value.map(s => s.name)).toEqual(['Robotics']);
  });

  it('refuses a day outside the session dates, and writes nothing', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);

    const refused = await service.addSeries(as('admin'), sessionId, series({ endsAt: '2027-08-30T12:00' }));

    expect(refused.ok).toBe(false);
    if (refused.ok) {
      return;
    }
    expect(refused.failure.reason).toBe('class_outside_session');
    const listed = await service.listSeries(as('admin'), sessionId);
    expect(listed.ok && listed.value).toEqual([]);
  });

  it('refuses a series with no weekday, with a message the screen can show', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);

    const refused = await service.addSeries(as('admin'), sessionId, series({ weekdays: [] }));

    expect(refused.ok).toBe(false);
    if (refused.ok) {
      return;
    }
    expect(refused.failure.reason).toBe('recurrence_invalid');
    expect(refused.failure.message).toBe('Choose at least one day of the week.');
  });
});

describe('class series: cancelling one day', () => {
  it('cancels one day: the series and its other days stay, and the day shows as cancelled', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);
    const made = await service.addSeries(as('admin'), sessionId, series());
    if (!made.ok) {
      throw new Error(made.failure.message);
    }
    const days = await service.listSeriesOccurrences(as('admin'), made.value.id);
    if (!days.ok) {
      throw new Error(days.failure.message);
    }
    const target = days.value[1];

    const cancelled = await service.cancelOccurrence(as('admin'), target.id, 'Public holiday');
    expect(cancelled.ok).toBe(true);

    const after = await service.listSeriesOccurrences(as('admin'), made.value.id);
    if (!after.ok) {
      throw new Error(after.failure.message);
    }
    expect(after.value.map(d => d.occurrenceStatus)).toEqual(['active', 'cancelled', 'active']);
    expect(after.value[1].cancelReason).toBe('Public holiday');
    const updated = await service.getSeries(as('admin'), made.value.id);
    if (!updated.ok) {
      throw new Error(updated.failure.message);
    }
    expect(updated.value.activeOccurrenceCount).toBe(2);
    expect(updated.value.occurrenceCount).toBe(3);
  });
});
