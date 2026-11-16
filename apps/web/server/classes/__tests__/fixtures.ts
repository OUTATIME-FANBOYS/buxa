import type { Actor, Role } from '@buxa/domain';
import type { NewClassInput, NewSessionInput } from '@buxa/contracts';
import { createClassService } from '../ClassService';
import { InMemoryClassRepository } from '../InMemoryClassRepository';

export const ORG = '11111111-1111-4111-8111-111111111111';
export const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
export const CAMP_TZ = 'Australia/Sydney';

export const CAMPER_ADA = '00000000-0000-4000-8000-0000000000a1';
export const CAMPER_BEN = '00000000-0000-4000-8000-0000000000b2';
export const CAMPER_CY = '00000000-0000-4000-8000-0000000000c3';

export const as = (role: Role, orgId = ORG, userId = `user-${role}`): Actor => ({ userId, orgId, role });

export const robotics: NewClassInput = {
  name: 'Robotics', description: 'Build and program small robots.', ageRange: { minAge: 8, maxAge: 12 }, capacity: 2,
  instructorRatio: { instructors: 1, campers: 8 },
};
export const painting: NewClassInput = {
  name: 'Painting', description: '', ageRange: { minAge: 6, maxAge: 14 }, capacity: 10, instructorRatio: null,
};

/** Monday 5 July 2027, 09:00-12:00 in Sydney (UTC+10 in July). */
export const monday9to12: NewSessionInput = {
  startsAt: '2027-07-05T09:00:00+10:00', endsAt: '2027-07-05T12:00:00+10:00', location: 'Lab 1', instructorIds: [],
};
/** Overlaps Monday 9-12 by two hours. */
export const monday11to13: NewSessionInput = {
  startsAt: '2027-07-05T11:00:00+10:00', endsAt: '2027-07-05T13:00:00+10:00', location: 'Art room', instructorIds: [],
};

export function setup() {
  const repo = new InMemoryClassRepository(() => new Date('2027-07-01T00:00:00Z'));
  const service = createClassService({ repo, timezoneOf: async () => CAMP_TZ });
  repo.seedCamper(ORG, CAMPER_ADA, 'Ada Lovelace', '2016-03-01');   // 11 in July 2027
  repo.seedCamper(ORG, CAMPER_BEN, 'Ben Carter', '2016-03-01');
  repo.seedCamper(ORG, CAMPER_CY, 'Cy Dunn', '2016-03-01');
  return { repo, service };
}

/** Creates a class and a session as an admin, returning their ids. */
export async function classWithSession(service: ReturnType<typeof createClassService>, cls: NewClassInput = robotics, session: NewSessionInput = monday9to12) {
  const created = await service.createClass(as('admin'), cls);
  if (!created.ok) throw new Error(created.failure.message);
  const added = await service.addSession(as('admin'), created.value.id, session);
  if (!added.ok) throw new Error(added.failure.message);
  return { classId: created.value.id, sessionId: added.value.id };
}
