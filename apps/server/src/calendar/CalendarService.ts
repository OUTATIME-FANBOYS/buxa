import { assertAllowed } from '../auth/authorize';
import { forbidden } from '../http/errors';
import { serializeCalendar, type Actor, type FeedClass } from '@buxa/domain';
import { generateCalendarToken, hashCalendarToken, looksLikeCalendarToken } from './calendarToken';

/*
 * The read-only iCal feed. There are two kinds of link. Each URL is the only credential a calendar app needs:
 *   - the camp link: one per camp, made by org:update, shows every session of the camp;
 *   - a teacher's own link: one per teacher per camp, made by that teacher, shows only the classes the teacher is assigned to.
 * Rotating a link makes its old URL stop working at once. Archived camps are refused: their feed answers as if the token did not exist.
 */

export interface FeedCamp {
  orgId: string;
  name: string;
  archived: boolean;
}

export interface CalendarRepository {
  /** The camp that owns a camp token hash, or null. Resolved by the database function, which returns nothing else. */
  findCampByTokenHash(hash: Buffer): Promise<FeedCamp | null>;
  /** Stores the hash for the camp, replacing any earlier one, and audits `calendar.token_rotate` in the same transaction. */
  saveTokenHash(actor: Actor, hash: Buffer): Promise<void>;
  /** Every session of the camp that owns the camp token hash, with its class name. No signed-in user: the token is the access. */
  listFeedClasses(tokenHash: Buffer): Promise<FeedClass[]>;
  /** The camp of a teacher's own token hash, or null when the hash is unknown or its holder is no longer a teacher. */
  findTeacherByTokenHash(hash: Buffer): Promise<FeedCamp | null>;
  /** Stores the hash for the actor's own link, replacing any earlier one, and audits `calendar.token_rotate_self` in the same transaction. */
  saveMemberTokenHash(actor: Actor, hash: Buffer): Promise<void>;
  /** The classes assigned to the teacher who owns the token hash, in its camp. Nothing for anyone else. */
  listTeacherFeedClasses(tokenHash: Buffer): Promise<FeedClass[]>;
}

export interface CalendarService {
  /** Makes a new camp token, stores its hash and returns the raw token. The raw token is not kept anywhere: show it once. */
  rotateToken(actor: Actor): Promise<string>;
  /** Makes a new personal link for the signed-in teacher, and returns the raw token (shown once). Only a teacher may. */
  rotateOwnToken(actor: Actor): Promise<string>;
  /** The calendar as text for this token, or null when the token is unknown, malformed, rotated away, or the camp is archived. */
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

    async rotateOwnToken(actor) {
      // A personal link shows the teacher's own classes, so only a teacher has one. Other roles use the camp link.
      if (actor.role !== 'teacher') {
        throw forbidden('Only a teacher has a personal calendar link');
      }
      const token = generateCalendarToken();
      await repo.saveMemberTokenHash(actor, hashCalendarToken(token));

      return token;
    },

    async feed(token, now) {
      if (!looksLikeCalendarToken(token)) {
        return null;
      }
      const hash = hashCalendarToken(token);

      const camp = await repo.findCampByTokenHash(hash);
      if (camp) {
        if (camp.archived) {
          return null;
        }
        const classes = await repo.listFeedClasses(hash);

        return serializeCalendar({ campName: camp.name, classes, generatedAt: now });
      }

      const teacher = await repo.findTeacherByTokenHash(hash);
      if (!teacher || teacher.archived) {
        return null;
      }
      const classes = await repo.listTeacherFeedClasses(hash);

      return serializeCalendar({ campName: `${teacher.name}: my classes`, classes, generatedAt: now });
    },
  };
}
