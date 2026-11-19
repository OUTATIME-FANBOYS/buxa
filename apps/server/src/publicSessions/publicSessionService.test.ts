import { describe, expect, it } from 'vitest';
import {
  createPublicSessionService,
  formatWhen,
  type PublicClass,
  type PublicSessionRecord,
  type PublicSessionRepository,
} from './PublicSessionService';

const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2027-07-01T00:00:00Z');

const session: PublicSessionRecord = {
  campName: 'Lakeside Camp',
  campTimeZone: 'Australia/Sydney',
  sessionName: 'Summer 2027',
  description: 'Two weeks in July.',
  startsOn: '2027-07-01',
  endsOn: '2027-07-31',
};

const classes: PublicClass[] = [
  {
    name: 'Painting',
    ageMin: 8,
    ageMax: 12,
    location: 'Studio',
    startsAt: '2027-07-04T23:00:00.000Z',
    endsAt: '2027-07-05T02:00:00.000Z',
  },
];

/** A repository that holds only the public fields, as the definer functions return them. */
function fakeRepo(overrides: Partial<PublicSessionRepository> = {}): PublicSessionRepository {
  return {
    findPublicSession: () => Promise.resolve(session),
    listUpcomingClasses: () => Promise.resolve(classes),
    ...overrides,
  };
}

describe('public session page', () => {
  it('shows the session name, dates and its upcoming classes', async () => {
    const page = await createPublicSessionService({ repo: fakeRepo() }).getPage('lakeside', SESSION_ID, NOW);

    expect(page).toEqual({
      campName: 'Lakeside Camp',
      timeZone: 'Australia/Sydney',
      sessionName: 'Summer 2027',
      description: 'Two weeks in July.',
      startsOn: '2027-07-01',
      endsOn: '2027-07-31',
      classes: [
        {
          name: 'Painting',
          ageRange: { minAge: 8, maxAge: 12 },
          location: 'Studio',
          startsAt: '2027-07-04T23:00:00.000Z',
          endsAt: '2027-07-05T02:00:00.000Z',
        },
      ],
    });
  });

  it('exposes no instructors, enrolled campers, seats or contact details', async () => {
    const page = await createPublicSessionService({ repo: fakeRepo() }).getPage('lakeside', SESSION_ID, NOW);
    const text = JSON.stringify(page).toLowerCase();

    for (const hidden of [
      'instructor',
      'enrol',
      'seat',
      'capacity',
      'waitlist',
      'email',
      'phone',
      'guardian',
      'medical',
    ]) {
      expect(text).not.toContain(hidden);
    }
  });

  it('returns nothing for a session the repository does not return (private, unknown or archived camp)', async () => {
    const service = createPublicSessionService({ repo: fakeRepo({ findPublicSession: () => Promise.resolve(null) }) });

    expect(await service.getPage('lakeside', SESSION_ID, NOW)).toBeNull();
  });

  it('refuses a malformed session id or an empty slug before any read', async () => {
    let reads = 0;
    const service = createPublicSessionService({
      repo: fakeRepo({
        findPublicSession: () => {
          reads += 1;

          return Promise.resolve(session);
        },
      }),
    });

    expect(await service.getPage('lakeside', 'not-a-uuid', NOW)).toBeNull();
    expect(await service.getPage('  ', SESSION_ID, NOW)).toBeNull();
    expect(reads).toBe(0);
  });

  it('writes an open-ended age range as 0 to 120', async () => {
    const service = createPublicSessionService({
      repo: fakeRepo({ listUpcomingClasses: () => Promise.resolve([{ ...classes[0], ageMin: null, ageMax: null }]) }),
    });
    const page = await service.getPage('lakeside', SESSION_ID, NOW);

    expect(page?.classes[0].ageRange).toEqual({ minAge: 0, maxAge: 120 });
  });
});

describe('formatWhen', () => {
  it('reads a class in the camp zone and repeats the day only when it ends on another day', () => {
    expect(formatWhen('2027-07-04T23:00:00.000Z', '2027-07-05T02:00:00.000Z', 'Australia/Sydney')).toBe(
      'Mon 5 Jul 2027, 9:00 am to 12:00 pm',
    );
    expect(formatWhen('2027-07-05T10:00:00+10:00', '2027-07-06T01:00:00+10:00', 'Australia/Sydney')).toBe(
      'Mon 5 Jul 2027, 10:00 am to Tue 6 Jul 2027, 1:00 am',
    );
  });
});
