import type { Actor, Role } from '@buxa/domain';
import type { ClassInput, NewSessionInput } from '@buxa/contracts';
import { createClassService } from '../ClassService';
import { InMemoryClassRepository } from '../InMemoryClassRepository';
import { settle } from '@buxa/domain';

export const ORG = '11111111-1111-4111-8111-111111111111';
export const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
export const CAMP_TZ = 'Australia/Sydney';

export const CAMPER_ADA = '00000000-0000-4000-8000-0000000000a1';
export const CAMPER_BEN = '00000000-0000-4000-8000-0000000000b2';
export const CAMPER_CY = '00000000-0000-4000-8000-0000000000c3';

export const as = (role: Role, orgId = ORG, userId = `user-${role}`): Actor => ({ userId, orgId, role });

/** A session (the parent): a date range that covers July 2027 in Sydney. */
export const JULY_SESSION: NewSessionInput = {
  name: 'Summer camp',
  description: 'Two weeks in July.',
  startsOn: '2027-07-01',
  endsOn: '2027-07-31',
};

/** A class's own fields, without its time range. Times are added per test (see `monday9to12`). */
export const robotics = {
  name: 'Robotics',
  ageRange: { minAge: 8, maxAge: 12 },
  capacity: 2,
  location: 'Lab 1',
  instructorIds: [],
};
export const painting = {
  name: 'Painting',
  ageRange: { minAge: 6, maxAge: 14 },
  capacity: 10,
  location: 'Art room',
  instructorIds: [],
};

/** Monday 5 July 2027, 09:00-12:00 in Sydney (UTC+10 in July). */
export const monday9to12 = {
  startsAt: '2027-07-05T09:00:00+10:00',
  endsAt: '2027-07-05T12:00:00+10:00',
};
/** Overlaps Monday 9-12 by two hours. */
export const monday11to13 = {
  startsAt: '2027-07-05T11:00:00+10:00',
  endsAt: '2027-07-05T13:00:00+10:00',
  location: 'Art room',
};

/** A class input: a class's fields with its time range. */
export const classAt = (
  cls: Omit<ClassInput, 'startsAt' | 'endsAt'>,
  times: { startsAt: string; endsAt: string },
): ClassInput => ({
  ...cls,
  ...times,
});

export function setup() {
  const repo = new InMemoryClassRepository(() => new Date('2027-07-01T00:00:00Z'));
  const service = createClassService({ repo, timezoneOf: () => settle(() => CAMP_TZ) });
  repo.seedCamper(ORG, CAMPER_ADA, 'Ada Lovelace', '2016-03-01'); // 11 in July 2027
  repo.seedCamper(ORG, CAMPER_BEN, 'Ben Carter', '2016-03-01');
  repo.seedCamper(ORG, CAMPER_CY, 'Cy Dunn', '2016-03-01');

  return { repo, service };
}

/**
 * Creates a session (July) and one class under it, as an admin. `sessionId` and `classId` are both returned; the class is the
 * unit an enrolment is made into, so tests enrol with `classId`.
 */
export async function classWithSession(
  service: ReturnType<typeof createClassService>,
  cls: Omit<ClassInput, 'startsAt' | 'endsAt'> = robotics,
  times: { startsAt: string; endsAt: string; location?: string; instructorIds?: string[] } = monday9to12,
) {
  const session = await service.createSession(as('admin'), JULY_SESSION);
  if (!session.ok) {
    throw new Error(session.failure.message);
  }
  const added = await service.addClass(as('admin'), session.value.id, {
    ...cls,
    ...times,
    location: times.location ?? cls.location,
    instructorIds: times.instructorIds ?? cls.instructorIds,
  });
  if (!added.ok) {
    throw new Error(added.failure.message);
  }

  return { sessionId: session.value.id, classId: added.value.id };
}
