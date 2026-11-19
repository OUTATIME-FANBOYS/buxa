import { assertAllowed } from '../auth/authorize';
import { serializeCalendar, type Actor, type FeedClass } from '@buxa/domain';
import { generateCalendarToken, hashCalendarToken, looksLikeCalendarToken } from './calendarToken';

/*
 * The read-only iCal feed. A camp has one token; its URL is the only credential a calendar app needs. Rotating the token makes the
 * old URL stop working at once. Archived camps are refused: their feed answers as if the token did not exist.
 */

export interface FeedCamp {
  orgId: string;
  name: string;
  archived: boolean;
}

export interface CalendarRepository {
  /** The camp that owns a token hash, or null. Resolved by the database function, which returns nothing else. */
  findCampByTokenHash(hash: Buffer): Promise<FeedCamp | null>;
  /** Stores the hash for the camp, replacing any earlier one, and audits `calendar.token_rotate` in the same transaction. */
  saveTokenHash(actor: Actor, hash: Buffer): Promise<void>;
  /** Every session of the camp, with its class name. Row-level security applies. */
  listFeedClasses(orgId: string): Promise<FeedClass[]>;
}

export interface CalendarService {
  /** Makes a new token, stores its hash and returns the raw token. The raw token is not kept anywhere: show it once. */
  rotateToken(actor: Actor): Promise<string>;
  /** The calendar as text for this token, or null when the token is unknown, malformed, or the camp is archived. */
  feed(token: string, now: Date): Promise<string | null>;
}

export function createCalendarService({ repo }: { repo: CalendarRepository }): CalendarService {
  return {
    async rotateToken(actor) {
      assertAllowed(actor, 'org:update');
      const token = generateCalendarToken();
      await repo.saveTokenHash(actor, hashCalendarToken(token));

      return token;
    },

    async feed(token, now) {
      if (!looksLikeCalendarToken(token)) {
        return null;
      }
      const camp = await repo.findCampByTokenHash(hashCalendarToken(token));
      if (!camp || camp.archived) {
        return null;
      }
      const classes = await repo.listFeedClasses(camp.orgId);

      return serializeCalendar({ campName: camp.name, classes, generatedAt: now });
    },
  };
}
