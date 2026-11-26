import { describe, expect, it } from 'vitest';
import type { Actor, FeedClass } from '@buxa/domain';
import { isHttpError } from '../http/errors';
import { createCalendarService } from './CalendarService';
import { generateCalendarToken, hashCalendarToken, looksLikeCalendarToken } from './calendarToken';
import { InMemoryCalendarRepository } from './InMemoryCalendarRepository';

const CAMP = '11111111-1111-4111-8111-111111111111';
const OTHER_CAMP = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2027-07-01T00:00:00Z');

const teacher: Actor = { userId: 'user-teacher', orgId: CAMP, role: 'viewer', instructor: true };
const teacherTwo: Actor = { userId: 'user-teacher-two', orgId: CAMP, role: 'viewer', instructor: true };
const unassigned: Actor = { userId: 'user-unassigned', orgId: CAMP, role: 'viewer', instructor: true };
const otherCampTeacher: Actor = { userId: 'user-other-camp', orgId: OTHER_CAMP, role: 'viewer', instructor: true };
const viewer: Actor = { userId: 'user-viewer', orgId: CAMP, role: 'viewer' };
const staff: Actor = { userId: 'user-staff', orgId: CAMP, role: 'staff' };
const admin: Actor = { userId: 'user-admin', orgId: CAMP, role: 'admin' };
const owner: Actor = { userId: 'user-owner', orgId: CAMP, role: 'owner' };

const ROBOTICS: FeedClass = {
  id: '6f1c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f',
  className: 'Robotics',
  startsAt: '2027-07-04T23:00:00.000Z',
  endsAt: '2027-07-05T02:00:00.000Z',
  location: 'Lab 1',
};
const PAINTING: FeedClass = {
  id: '7a2d2e3f-4b5c-4d6e-9fa0-1b2c3d4e5f60',
  className: 'Painting',
  startsAt: '2027-07-05T01:00:00.000Z',
  endsAt: '2027-07-05T03:00:00.000Z',
  location: 'Studio',
};
const POTTERY: FeedClass = {
  id: '8b3e3f40-5c6d-4e7f-8a1b-2c3d4e5f6071',
  className: 'Pottery',
  startsAt: '2027-07-05T03:00:00.000Z',
  endsAt: '2027-07-05T05:00:00.000Z',
  location: 'Kiln room',
};
const KAYAKING: FeedClass = {
  id: '9c4f4a51-6d7e-4f80-9b2c-3d4e5f607182',
  className: 'Kayaking',
  startsAt: '2027-07-05T23:00:00.000Z',
  endsAt: '2027-07-06T01:00:00.000Z',
  location: 'Jetty',
};

const CAMP_CLASSES: Record<string, FeedClass[]> = {
  [CAMP]: [ROBOTICS, PAINTING, POTTERY],
  [OTHER_CAMP]: [KAYAKING],
};

function setup() {
  const repo = new InMemoryCalendarRepository(orgId => CAMP_CLASSES[orgId] ?? []);
  repo.seedCamp(CAMP, 'Camp Pine');
  repo.seedCamp(OTHER_CAMP, 'Camp Birch');
  for (const t of [teacher, teacherTwo, unassigned]) {
    repo.seedTeacher(t.orgId, t.userId);
  }
  repo.seedTeacher(OTHER_CAMP, otherCampTeacher.userId);
  repo.assign(CAMP, teacher.userId, ROBOTICS.id);
  repo.assign(CAMP, teacher.userId, PAINTING.id);
  repo.assign(CAMP, teacherTwo.userId, PAINTING.id);
  repo.assign(CAMP, teacherTwo.userId, POTTERY.id);
  repo.assign(OTHER_CAMP, otherCampTeacher.userId, KAYAKING.id);
  const service = createCalendarService({ repo });

  return { repo, service };
}

const unfold = (text: string) => text.replace(/\r\n[ \t]/g, '');
const summaries = (text: string | null): string[] =>
  unfold(text ?? '')
    .split('\r\n')
    .filter(line => line.startsWith('SUMMARY:'))
    .map(line => line.slice('SUMMARY:'.length));

describe('teacher calendar link: making it', () => {
  it('a teacher gets a 256-bit link token, and the audit names the action, never the token', async () => {
    const { service, repo } = setup();

    const token = await service.rotateOwnToken(teacher);

    expect(looksLikeCalendarToken(token)).toBe(true);
    expect(JSON.stringify(repo.audit)).not.toContain(token);
    expect(JSON.stringify(repo.audit)).not.toContain(hashCalendarToken(token).toString('hex'));
    expect(repo.audit.map(a => a.action)).toEqual(['calendar.rotate_self']);
    expect(repo.audit[0]).toMatchObject({ actorId: teacher.userId, orgId: CAMP, entityId: teacher.userId });
  });

  it('only a teacher may make a personal link: viewers, staff, admins and owners get a 403', async () => {
    const { service } = setup();

    for (const actor of [viewer, staff, admin, owner]) {
      const err = await service.rotateOwnToken(actor).then(
        () => null,
        (e: unknown) => e,
      );
      expect(isHttpError(err) && err.statusCode, actor.role).toBe(403);
    }
  });

  it('rotating a personal link makes the old one stop at once', async () => {
    const { service } = setup();
    const first = await service.rotateOwnToken(teacher);
    expect(await service.feed(first, NOW)).not.toBeNull();

    const second = await service.rotateOwnToken(teacher);

    expect(await service.feed(first, NOW)).toBeNull();
    expect(summaries(await service.feed(second, NOW))).toEqual(['Robotics', 'Painting']);
  });
});

describe('teacher calendar link: the feed shows only the teacher’s classes', () => {
  it('a teacher sees the classes assigned to them, in this camp, and no others', async () => {
    const { service } = setup();
    const token = await service.rotateOwnToken(teacher);

    const text = await service.feed(token, NOW);

    expect(text?.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(unfold(text ?? '')).toContain('X-WR-CALNAME:Camp Pine: my classes');
    expect(summaries(text)).toEqual(['Robotics', 'Painting']);
    expect(text).not.toContain('Pottery');
    expect(text).not.toContain('Kayaking');
  });

  it('another teacher in the same camp sees their own classes, not the ones they do not teach', async () => {
    const { service } = setup();
    const token = await service.rotateOwnToken(teacherTwo);

    expect(summaries(await service.feed(token, NOW))).toEqual(['Painting', 'Pottery']);
  });

  it('an unassigned teacher gets a valid empty calendar, not an error', async () => {
    const { service } = setup();
    const token = await service.rotateOwnToken(unassigned);

    const text = await service.feed(token, NOW);

    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('END:VCALENDAR');
    expect(text).not.toContain('BEGIN:VEVENT');
  });

  it('a teacher of another camp sees only that camp’s classes, never camp A’s', async () => {
    const { service } = setup();
    const token = await service.rotateOwnToken(otherCampTeacher);

    expect(summaries(await service.feed(token, NOW))).toEqual(['Kayaking']);
  });

  it('a viewer who somehow holds a link sees nothing: the feed refuses a person who is not a teacher', async () => {
    const { service, repo } = setup();
    const token = generateCalendarToken();
    await repo.saveMemberTokenHash(viewer, hashCalendarToken(token));

    expect(await service.feed(token, NOW)).toBeNull();
  });

  it('a person who stops being a teacher loses the link at once', async () => {
    const { service, repo } = setup();
    const token = await service.rotateOwnToken(teacher);
    repo.removeTeacher(CAMP, teacher.userId);

    expect(await service.feed(token, NOW)).toBeNull();
  });

  it('an archived camp refuses a teacher’s link, as for a bad token', async () => {
    const { service, repo } = setup();
    const token = await service.rotateOwnToken(teacher);
    repo.archive(CAMP);

    expect(await service.feed(token, NOW)).toBeNull();
  });

  it('unknown, malformed and empty tokens get the same null as before', async () => {
    const { service } = setup();
    await service.rotateOwnToken(teacher);

    expect(await service.feed('A'.repeat(43), NOW)).toBeNull();
    expect(await service.feed('too-short', NOW)).toBeNull();
    expect(await service.feed('', NOW)).toBeNull();
  });

  it('the camp link still lists every session of the camp, not only one teacher’s', async () => {
    const { service, repo } = setup();
    const campToken = await service.rotateToken(owner);

    expect(summaries(await service.feed(campToken, NOW))).toEqual(['Robotics', 'Painting', 'Pottery']);
    expect(repo.audit.map(a => a.action)).toContain('calendar.token_rotate');
  });
});
