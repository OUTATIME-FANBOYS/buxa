import { isUuid } from '@buxa/domain';

/*
 * The public session page: read by anyone, with no sign-in. It shows the session's name and dates and its upcoming classes (when,
 * where, which ages). Instructors, enrolled campers, seats, counts and contact details are never part of this page's data, so
 * they cannot leak through it. Only sessions marked public are returned, and only for camps that are not archived.
 */

export interface PublicSessionRecord {
  campName: string;
  campTimeZone: string;
  sessionName: string;
  description: string;
  /** Camp-local days, YYYY-MM-DD. */
  startsOn: string | null;
  endsOn: string | null;
}

export interface PublicClass {
  name: string;
  /** Null means open-ended on that side. */
  ageMin: number | null;
  ageMax: number | null;
  location: string;
  startsAt: string;
  endsAt: string;
}

export interface PublicSessionPage {
  campName: string;
  timeZone: string;
  sessionName: string;
  description: string;
  startsOn: string | null;
  endsOn: string | null;
  classes: {
    name: string;
    ageRange: { minAge: number; maxAge: number };
    location: string;
    startsAt: string;
    endsAt: string;
  }[];
}

export interface PublicSessionRepository {
  /** The session if it is public and its camp is not archived; otherwise null. */
  findPublicSession(slug: string, sessionId: string): Promise<PublicSessionRecord | null>;
  /** Classes that have not ended by `from`, soonest first. Their own name, ages, times and location only. */
  listUpcomingClasses(slug: string, sessionId: string, from: Date): Promise<PublicClass[]>;
}

export interface PublicSessionService {
  getPage(slug: string, sessionId: string, now: Date): Promise<PublicSessionPage | null>;
}

export function createPublicSessionService({ repo }: { repo: PublicSessionRepository }): PublicSessionService {
  return {
    async getPage(slug, sessionId, now) {
      if (!isUuid(sessionId) || slug.trim() === '') {
        return null;
      }
      const session = await repo.findPublicSession(slug, sessionId);
      if (!session) {
        return null;
      }
      const classes = await repo.listUpcomingClasses(slug, sessionId, now);

      return {
        campName: session.campName,
        timeZone: session.campTimeZone,
        sessionName: session.sessionName,
        description: session.description,
        startsOn: session.startsOn,
        endsOn: session.endsOn,
        classes: classes.map(c => ({
          name: c.name,
          ageRange: { minAge: c.ageMin ?? 0, maxAge: c.ageMax ?? 120 },
          location: c.location,
          startsAt: c.startsAt,
          endsAt: c.endsAt,
        })),
      };
    },
  };
}

/**
 * "Mon 5 Jul 2027, 9:00 am to 12:00 pm" in the camp's zone, built from parts so the text does not depend on the locale data the
 * server has. A class that ends on another day repeats the day.
 */
export function formatWhen(startsAt: string, endsAt: string, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const parts = (iso: string) => {
    const got: Record<string, string> = {};
    for (const p of fmt.formatToParts(new Date(iso))) {
      got[p.type] = p.value;
    }
    const date = `${got.weekday} ${got.day} ${got.month} ${got.year}`;
    const time = `${got.hour}:${got.minute} ${(got.dayPeriod ?? '').toLowerCase()}`;

    return { date, time };
  };
  const start = parts(startsAt);
  const end = parts(endsAt);
  const endText = start.date === end.date ? end.time : `${end.date}, ${end.time}`;

  return `${start.date}, ${start.time} to ${endText}`;
}
