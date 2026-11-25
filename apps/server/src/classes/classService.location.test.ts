import { describe, expect, it } from 'vitest';
import type { NewSeriesInput } from '@buxa/contracts';
import { CAMPER_ADA, JULY_SESSION, as, monday9to12, robotics, setup } from './__tests__/fixtures';

/** Robotics runs in 'Lab 1' on Monday 5 July, 09:00 to 12:00 camp time (see fixtures). */
const lab = { ...robotics, ...monday9to12 };

/** A class on the same day as Robotics, 10:00 to 13:00, in the given location. */
const overlapping = (location: string, name = 'Pottery Class') => ({
  ...lab,
  name,
  location,
  startsAt: '2027-07-05T10:00:00+10:00',
  endsAt: '2027-07-05T13:00:00+10:00',
});

/** A series of Mondays, 5 July to 19 July 2027, 09:00 to 12:00 camp time. */
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
  await service.publishSession(as('admin'), session.value.id);

  return session.value.id;
}

describe('the location rule: classes in different locations may overlap', () => {
  it('two overlapping classes in different locations both save', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);

    const first = await service.addClass(as('admin'), sessionId, lab);
    const second = await service.addClass(as('admin'), sessionId, overlapping('Studio'));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
  });

  it('a series may overlap a class in another location', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);
    await service.addClass(as('admin'), sessionId, lab);

    const made = await service.addSeries(as('admin'), sessionId, series({ location: 'Studio' }));

    expect(made.ok).toBe(true);
  });
});

describe('the location rule: classes in the same location may not overlap', () => {
  it('the second of two overlapping classes in one location is refused, naming the first, its location and times', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);
    await service.addClass(as('admin'), sessionId, lab);

    const refused = await service.addClass(as('admin'), sessionId, overlapping('Lab 1'));

    expect(refused.ok).toBe(false);
    if (refused.ok) {
      return;
    }
    expect(refused.failure.reason).toBe('class_clash');
    expect(refused.failure.message).toBe(
      'Pottery Class on 2027-07-05 clashes with Robotics at Lab 1 (Mon 5 Jul, 09:00-12:00). Two classes in the same location cannot overlap. Choose other times, days or a location; nothing was saved.',
    );
    const listed = await service.listClasses(as('admin'), sessionId);
    expect(listed.ok && listed.value.map(c => c.name)).toEqual(['Robotics']);
  });

  it('the location is compared case and spacing insensitive', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);
    await service.addClass(as('admin'), sessionId, lab);

    const refused = await service.addClass(as('admin'), sessionId, overlapping('  lab   1 '));

    expect(refused.ok).toBe(false);
  });

  it('the same location on another day, or at non-overlapping times, is allowed', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);
    await service.addClass(as('admin'), sessionId, lab);

    const nextDay = await service.addClass(as('admin'), sessionId, {
      ...overlapping('Lab 1'),
      startsAt: '2027-07-06T10:00:00+10:00',
      endsAt: '2027-07-06T13:00:00+10:00',
    });
    const afterwards = await service.addClass(as('admin'), sessionId, {
      ...overlapping('Lab 1'),
      startsAt: '2027-07-05T12:00:00+10:00',
      endsAt: '2027-07-05T13:00:00+10:00',
    });

    expect(nextDay.ok).toBe(true);
    expect(afterwards.ok).toBe(true);
  });

  it('a series whose day overlaps a class in the same location is refused and writes nothing', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);
    await service.addClass(as('admin'), sessionId, lab);

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
    expect(refused.failure.message).toMatch(/clashes with Robotics at Lab 1 \(Mon 5 Jul, 09:00-12:00\)/);
    const listed = await service.listSeries(as('admin'), sessionId);
    expect(listed.ok && listed.value.map(s => s.name)).toEqual(['Robotics']);
  });

  it('editing a class into a clash in its new location is refused', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);
    await service.addClass(as('admin'), sessionId, lab);
    const moved = await service.addClass(as('admin'), sessionId, overlapping('Studio'));
    if (!moved.ok) {
      throw new Error(moved.failure.message);
    }

    const refused = await service.updateClass(as('admin'), moved.value.id, overlapping('Lab 1'));

    expect(refused.ok).toBe(false);
    if (refused.ok) {
      return;
    }
    expect(refused.failure.reason).toBe('class_clash');
    expect(refused.failure.message).toMatch(/clashes with Robotics at Lab 1/);
  });

  it('editing a series into a clash in its new location is refused, and the series keeps its location', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);
    await service.addClass(as('admin'), sessionId, lab);
    const made = await service.addSeries(as('admin'), sessionId, series({ location: 'Studio' }));
    if (!made.ok) {
      throw new Error(made.failure.message);
    }

    const refused = await service.updateSeries(as('admin'), made.value.id, series({ location: 'Lab 1' }));

    expect(refused.ok).toBe(false);
    if (refused.ok) {
      return;
    }
    expect(refused.failure.reason).toBe('class_clash');
    expect(refused.failure.message).toMatch(/clashes with Robotics at Lab 1/);
    const after = await service.getSeries(as('admin'), made.value.id);
    expect(after.ok && after.value.location).toBe('Studio');
  });

  it('restoring a cancelled day into a clash in its location is refused', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);
    const made = await service.addSeries(as('admin'), sessionId, series({ location: 'Lab 1' }));
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
    // While the day is cancelled, a class in the same place and time is allowed.
    const takesSlot = await service.addClass(as('admin'), sessionId, {
      ...overlapping('Lab 1'),
      startsAt: target.startsAt,
      endsAt: target.endsAt,
    });
    expect(takesSlot.ok).toBe(true);

    const restored = await service.restoreOccurrence(as('admin'), target.id);

    expect(restored.ok).toBe(false);
    if (restored.ok) {
      return;
    }
    expect(restored.failure.reason).toBe('class_clash');
    expect(restored.failure.message).toMatch(/clashes with Pottery Class at Lab 1/);
  });
});

describe('the child rule: a child cannot be in two overlapping classes, in any location', () => {
  it('a child enrolled in one class cannot be enrolled in an overlapping class in another location', async () => {
    const { service } = setup();
    const sessionId = await newSession(service);
    const first = await service.addClass(as('admin'), sessionId, lab);
    const second = await service.addClass(as('admin'), sessionId, overlapping('Studio', 'Swim Stars'));
    if (!first.ok || !second.ok) {
      throw new Error('setup failed');
    }
    const placed = await service.enrol(as('admin'), {
      classId: first.value.id,
      camperId: CAMPER_ADA,
      waitlistIfFull: false,
    });
    expect(placed.ok).toBe(true);

    const refused = await service.enrol(as('admin'), {
      classId: second.value.id,
      camperId: CAMPER_ADA,
      waitlistIfFull: false,
    });

    expect(refused.ok).toBe(false);
    if (refused.ok) {
      return;
    }
    expect(refused.failure.message).toMatch(
      /^Ada Lovelace is already in another class at this time: Robotics \(Mon 5 Jul, 09:00-12:00\)$/,
    );
  });
});
