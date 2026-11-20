import type { Actor, FeedClass } from '@buxa/domain';
import { settle } from '@buxa/domain';
import type { AuditRecord } from '../people/InMemoryDatabase';
import type { CalendarRepository, FeedCamp } from './CalendarService';

interface StoredCamp extends FeedCamp {
  tokenHash: string | null;
}

interface StoredMemberLink {
  orgId: string;
  userId: string;
  tokenHash: string;
}

/**
 * In-memory calendar storage for tests. Same answers as the Postgres adapter: a hash resolves to one camp, an archived camp
 * still resolves (the service refuses it), and rotating replaces the hash. `classesOf` supplies the camp's sessions.
 * Teachers are added with `seedTeacher` and given classes with `assign`; a teacher's feed holds only the classes assigned to them.
 */
export class InMemoryCalendarRepository implements CalendarRepository {
  readonly audit: AuditRecord[] = [];
  private readonly camps = new Map<string, StoredCamp>();
  private readonly teachers = new Set<string>();
  private readonly assignments = new Set<string>();
  private readonly memberLinks = new Map<string, StoredMemberLink>();

  constructor(private readonly classesOf: (orgId: string) => FeedClass[] = () => []) {}

  /** Test setup: a camp that exists. */
  seedCamp(orgId: string, name: string, archived = false): void {
    this.camps.set(orgId, { orgId, name, archived, tokenHash: null });
  }

  /** Test setup: a person whose role in the camp is teacher. */
  seedTeacher(orgId: string, userId: string): void {
    this.teachers.add(memberKey(orgId, userId));
  }

  /** Test setup: the person stops being a teacher (their link then resolves to nothing). */
  removeTeacher(orgId: string, userId: string): void {
    this.teachers.delete(memberKey(orgId, userId));
  }

  /** Test setup: the class is assigned to the teacher. */
  assign(orgId: string, userId: string, classId: string): void {
    this.assignments.add(`${memberKey(orgId, userId)}:${classId}`);
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
      const camp = this.campOf(tokenHash);

      return camp && !camp.archived ? this.classesOf(camp.orgId) : [];
    });
  }

  findTeacherByTokenHash(hash: Buffer): Promise<FeedCamp | null> {
    return settle(() => {
      const link = this.linkOf(hash);
      if (!link || !this.teachers.has(memberKey(link.orgId, link.userId))) {
        return null;
      }
      const camp = this.camps.get(link.orgId);

      return camp ? { orgId: camp.orgId, name: camp.name, archived: camp.archived } : null;
    });
  }

  saveMemberTokenHash(actor: Actor, hash: Buffer): Promise<void> {
    return settle(() => {
      this.memberLinks.set(memberKey(actor.orgId, actor.userId), {
        orgId: actor.orgId,
        userId: actor.userId,
        tokenHash: hash.toString('hex'),
      });
      this.audit.push({
        orgId: actor.orgId,
        actorId: actor.userId,
        action: 'calendar.rotate_self',
        entity: 'member',
        entityId: actor.userId,
        data: {},
      });
    });
  }

  listTeacherFeedClasses(tokenHash: Buffer): Promise<FeedClass[]> {
    return settle(() => {
      const link = this.linkOf(tokenHash);
      const camp = link ? this.camps.get(link.orgId) : undefined;
      if (!link || !camp || camp.archived || !this.teachers.has(memberKey(link.orgId, link.userId))) {
        return [];
      }

      return this.classesOf(link.orgId).filter(c =>
        this.assignments.has(`${memberKey(link.orgId, link.userId)}:${c.id}`),
      );
    });
  }

  private campOf(tokenHash: Buffer): StoredCamp | undefined {
    const key = tokenHash.toString('hex');

    return [...this.camps.values()].find(c => c.tokenHash === key);
  }

  private linkOf(tokenHash: Buffer): StoredMemberLink | undefined {
    const key = tokenHash.toString('hex');

    return [...this.memberLinks.values()].find(l => l.tokenHash === key);
  }
}

const memberKey = (orgId: string, userId: string): string => `${orgId}:${userId}`;
