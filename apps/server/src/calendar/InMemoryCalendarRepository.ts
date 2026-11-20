import type { Actor, FeedClass } from '@buxa/domain';
import { settle } from '@buxa/domain';
import type { AuditRecord } from '../people/InMemoryDatabase';
import type { CalendarRepository, FeedCamp } from './CalendarService';

interface StoredCamp extends FeedCamp {
  tokenHash: string | null;
}

/**
 * In-memory calendar storage for tests. Same answers as the Postgres adapter: a hash resolves to one camp, an archived camp
 * still resolves (the service refuses it), and rotating replaces the hash. `classesOf` supplies the camp's sessions.
 */
export class InMemoryCalendarRepository implements CalendarRepository {
  readonly audit: AuditRecord[] = [];
  private readonly camps = new Map<string, StoredCamp>();

  constructor(private readonly classesOf: (orgId: string) => FeedClass[] = () => []) {}

  /** Test setup: a camp that exists. */
  seedCamp(orgId: string, name: string, archived = false): void {
    this.camps.set(orgId, { orgId, name, archived, tokenHash: null });
  }

  archive(orgId: string): void {
    const camp = this.camps.get(orgId);
    if (camp) {
      camp.archived = true;
    }
  }

  findCampByTokenHash(hash: Buffer): Promise<FeedCamp | null> {
    return settle(() => {
      const key = hash.toString('hex');
      for (const camp of this.camps.values()) {
        if (camp.tokenHash === key) {
          return { orgId: camp.orgId, name: camp.name, archived: camp.archived };
        }
      }

      return null;
    });
  }

  saveTokenHash(actor: Actor, hash: Buffer): Promise<void> {
    return settle(() => {
      const camp = this.camps.get(actor.orgId);
      if (!camp) {
        throw new Error('camp not found');
      }
      camp.tokenHash = hash.toString('hex');
      this.audit.push({
        orgId: actor.orgId,
        actorId: actor.userId,
        action: 'calendar.token_rotate',
        entity: 'camp',
        entityId: actor.orgId,
        data: {},
      });
    });
  }

  listFeedClasses(tokenHash: Buffer): Promise<FeedClass[]> {
    return settle(() => {
      const key = tokenHash.toString('hex');
      const camp = [...this.camps.values()].find(c => c.tokenHash === key && !c.archived);

      return camp ? this.classesOf(camp.orgId) : [];
    });
  }
}
