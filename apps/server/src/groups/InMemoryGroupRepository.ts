import { randomUUID } from 'node:crypto';
import { STAFF_ROLES, type Actor, type AssignRole, type AuditAction, type AgeRange, type RoomUse } from '@buxa/domain';
import { settle } from '@buxa/domain';
import type { Assignment, Group, GroupInput, Room, RoomInput } from '@buxa/contracts';
import type {
  AssignRequest,
  AssignmentRule,
  GatheredAssignmentFacts,
  GroupRepository,
  UnassignRequest,
  Unassigned,
} from './GroupRepository';
import {
  AssignmentConflictError,
  AssignmentRefusedError,
  CapacityBelowPlacedError,
  GroupNotFoundError,
  NotAssignedError,
  SessionUndatedError,
  NameTakenError,
  PersonNotFoundError,
  RoomNotFoundError,
  SessionNotFoundError,
} from './errors';

/** A session (the app's time-range row) as the in-memory store keeps it: the ids and times the rules read. */
export interface InMemorySession {
  id: string;
  orgId: string;
  name: string;
  /** The first and last camp days, both included. Null until the session has dates. */
  startsOn: string | null;
  endsOn: string | null;
}

/** A person with their date of birth and camp roles. Only the roles and the date of birth are read by the rules. */
export interface InMemoryPerson {
  id: string;
  orgId: string;
  name: string;
  dateOfBirth: string | null;
  roles: string[];
}

/** One audit entry, as the in-memory store keeps it for tests to read. */
export interface InMemoryAudit {
  action: AuditAction;
  entityId: string;
  data: Record<string, unknown>;
}

interface GroupRecord {
  id: string;
  orgId: string;
  sessionId: string;
  name: string;
  capacity: number;
  ratioCampers: number | null;
  ageRange: AgeRange | null;
}

interface RoomRecord {
  id: string;
  orgId: string;
  sessionId: string;
  name: string;
  location: string;
  capacity: number;
}

interface AssignmentRecord {
  id: string;
  orgId: string;
  sessionId: string;
  personId: string;
  role: AssignRole;
  groupId: string;
  roomId: string;
  active: boolean;
  overrideReason: string | null;
}

const STAFF: readonly string[] = STAFF_ROLES;

/**
 * In-memory adapter for groups, rooms and assignments, for tests and for running the app without a database. Each method is
 * synchronous inside (no await before the write), so two parallel calls run one after the other, as the Postgres locks make them.
 * Sessions and people are seeded by the tests, since this store does not own them.
 */
export class InMemoryGroupRepository implements GroupRepository {
  readonly audit: InMemoryAudit[] = [];
  private readonly sessions = new Map<string, InMemorySession>();
  private readonly people = new Map<string, InMemoryPerson>();
  private readonly groups = new Map<string, GroupRecord>();
  private readonly rooms = new Map<string, RoomRecord>();
  private readonly assignments = new Map<string, AssignmentRecord>();

  /** Test setup: a session in a camp. */
  seedSession(session: Partial<InMemorySession> & { orgId: string }): InMemorySession {
    const full: InMemorySession = { id: randomUUID(), name: 'Session', startsOn: null, endsOn: null, ...session };
    this.sessions.set(full.id, full);

    return full;
  }

  /** Test setup: a person in a camp. */
  seedPerson(person: Partial<InMemoryPerson> & { orgId: string }): InMemoryPerson {
    const full: InMemoryPerson = { id: randomUUID(), name: 'Person', dateOfBirth: null, roles: ['camper'], ...person };
    this.people.set(full.id, full);

    return full;
  }

  listGroups(_userId: string, orgId: string, sessionId: string): Promise<Group[]> {
    return settle(() => {
      this.requireSession(orgId, sessionId);

      return [...this.groups.values()]
        .filter(g => g.orgId === orgId && g.sessionId === sessionId)
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id.localeCompare(b.id))
        .map(g => this.groupView(g));
    });
  }

  listRooms(_userId: string, orgId: string, sessionId: string): Promise<Room[]> {
    return settle(() => {
      this.requireSession(orgId, sessionId);

      return [...this.rooms.values()]
        .filter(r => r.orgId === orgId && r.sessionId === sessionId)
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id.localeCompare(b.id))
        .map(r => this.roomView(r));
    });
  }

  listAssignments(_userId: string, orgId: string, sessionId: string): Promise<Assignment[]> {
    return settle(() => {
      this.requireSession(orgId, sessionId);

      return [...this.assignments.values()]
        .filter(a => a.orgId === orgId && a.sessionId === sessionId && a.active)
        .map(a => this.assignmentView(a));
    });
  }

  createGroup(actor: Actor, sessionId: string, input: GroupInput): Promise<Group> {
    return settle(() => {
      this.requireSession(actor.orgId, sessionId);
      this.assertGroupName(actor.orgId, sessionId, input.name, null);
      const group: GroupRecord = {
        id: randomUUID(),
        orgId: actor.orgId,
        sessionId,
        name: input.name,
        capacity: input.capacity,
        ratioCampers: input.ratioCampers,
        ageRange: input.ageRange,
      };
      this.groups.set(group.id, group);
      this.audit.push({ action: 'group.create', entityId: group.id, data: { sessionId, name: input.name } });

      return this.groupView(group);
    });
  }

  updateGroup(actor: Actor, groupId: string, input: GroupInput): Promise<Group> {
    return settle(() => {
      const group = this.groups.get(groupId);
      if (!group || group.orgId !== actor.orgId) {
        throw new GroupNotFoundError();
      }
      if (input.capacity < this.groupView(group).campers) {
        throw new CapacityBelowPlacedError('group');
      }
      this.assertGroupName(actor.orgId, group.sessionId, input.name, groupId);
      Object.assign(group, {
        name: input.name,
        capacity: input.capacity,
        ratioCampers: input.ratioCampers,
        ageRange: input.ageRange,
      });
      this.audit.push({
        action: 'group.update',
        entityId: groupId,
        data: { sessionId: group.sessionId, name: input.name },
      });

      return this.groupView(group);
    });
  }

  createRoom(actor: Actor, sessionId: string, input: RoomInput): Promise<Room> {
    return settle(() => {
      this.requireSession(actor.orgId, sessionId);
      this.assertRoomName(actor.orgId, sessionId, input.name, null);
      const room: RoomRecord = { id: randomUUID(), orgId: actor.orgId, sessionId, ...input };
      this.rooms.set(room.id, room);
      this.audit.push({ action: 'room.create', entityId: room.id, data: { sessionId, name: input.name } });

      return this.roomView(room);
    });
  }

  updateRoom(actor: Actor, roomId: string, input: RoomInput): Promise<Room> {
    return settle(() => {
      const room = this.rooms.get(roomId);
      if (!room || room.orgId !== actor.orgId) {
        throw new RoomNotFoundError();
      }
      if (input.capacity < this.roomView(room).campers) {
        throw new CapacityBelowPlacedError('room');
      }
      this.assertRoomName(actor.orgId, room.sessionId, input.name, roomId);
      Object.assign(room, input);
      this.audit.push({
        action: 'room.update',
        entityId: roomId,
        data: { sessionId: room.sessionId, name: input.name },
      });

      return this.roomView(room);
    });
  }

  assign(actor: Actor, request: AssignRequest, rule: AssignmentRule): Promise<Assignment> {
    return settle(() => {
      const session = this.requireSession(actor.orgId, request.sessionId);
      if (session.startsOn === null || session.endsOn === null) {
        throw new SessionUndatedError();
      }
      const days = { startsOn: session.startsOn, endsOn: session.endsOn };
      const person = this.people.get(request.personId);
      if (!person || person.orgId !== actor.orgId) {
        throw new PersonNotFoundError();
      }
      const group = this.groups.get(request.groupId);
      if (!group || group.orgId !== actor.orgId || group.sessionId !== request.sessionId) {
        throw new GroupNotFoundError();
      }
      const room = this.rooms.get(request.roomId);
      if (!room || room.orgId !== actor.orgId || room.sessionId !== request.sessionId) {
        throw new RoomNotFoundError();
      }
      const current = [...this.assignments.values()].find(
        a => a.active && a.sessionId === request.sessionId && a.personId === request.personId,
      );

      const decision = rule(this.gather(actor.orgId, days, request, person, group, room));
      if (decision.kind === 'refuse') {
        throw new AssignmentRefusedError(decision);
      }

      const overrideReason = decision.overrode?.reason ?? null;
      const record = current ?? this.insertRecord(actor.orgId, request, overrideReason);
      if (current) {
        const moved =
          current.groupId !== request.groupId || current.roomId !== request.roomId || current.role !== request.role;
        Object.assign(current, {
          groupId: request.groupId,
          roomId: request.roomId,
          role: request.role,
          overrideReason,
        });
        if (moved) {
          this.audit.push({ action: 'assignment.move', entityId: current.id, data: { sessionId: request.sessionId } });
        }
      } else {
        this.audit.push({ action: 'assignment.create', entityId: record.id, data: { sessionId: request.sessionId } });
      }
      if (decision.overrode) {
        this.audit.push({
          action: 'assignment.override',
          entityId: record.id,
          data: { sessionId: request.sessionId, reason: decision.overrode.reason },
        });
      }

      return this.assignmentView(record);
    });
  }

  unassign(actor: Actor, request: UnassignRequest): Promise<Unassigned> {
    return settle(() => {
      this.requireSession(actor.orgId, request.sessionId);
      const person = this.people.get(request.personId);
      if (!person || person.orgId !== actor.orgId) {
        throw new PersonNotFoundError();
      }
      const current = [...this.assignments.values()].find(
        a => a.active && a.sessionId === request.sessionId && a.personId === request.personId,
      );
      if (!current) {
        throw new NotAssignedError();
      }
      current.active = false;
      this.audit.push({
        action: 'assignment.unassign',
        entityId: current.id,
        data: {
          sessionId: request.sessionId,
          personId: request.personId,
          groupId: current.groupId,
          roomId: current.roomId,
        },
      });

      return { id: current.id, personId: request.personId, groupId: current.groupId, roomId: current.roomId };
    });
  }

  private insertRecord(orgId: string, request: AssignRequest, overrideReason: string | null): AssignmentRecord {
    const record: AssignmentRecord = {
      id: randomUUID(),
      orgId,
      sessionId: request.sessionId,
      personId: request.personId,
      role: request.role,
      groupId: request.groupId,
      roomId: request.roomId,
      active: true,
      overrideReason,
    };
    if (
      [...this.assignments.values()].some(
        a => a.active && a.sessionId === record.sessionId && a.personId === record.personId,
      )
    ) {
      throw new AssignmentConflictError();
    }
    this.assignments.set(record.id, record);

    return record;
  }

  /** The facts the rule needs. Counts exclude the person being placed, so a move is judged as a fresh placement. */
  private gather(
    orgId: string,
    days: { startsOn: string; endsOn: string },
    request: AssignRequest,
    person: InMemoryPerson,
    group: GroupRecord,
    room: RoomRecord,
  ): GatheredAssignmentFacts {
    const others = [...this.assignments.values()].filter(
      a => a.orgId === orgId && a.active && a.personId !== request.personId,
    );
    const inGroup = others.filter(a => a.groupId === group.id);
    const roomCampers = others.filter(a => a.roomId === room.id && a.role === 'camper').length;
    const roomUses: RoomUse[] = [];
    for (const a of others) {
      const otherRoom = this.rooms.get(a.roomId);
      const otherSession = this.sessions.get(a.sessionId);
      if (
        !otherRoom ||
        !otherSession ||
        a.sessionId === request.sessionId ||
        otherRoom.name.toLowerCase() !== room.name.toLowerCase() ||
        otherRoom.location.toLowerCase() !== room.location.toLowerCase()
      ) {
        continue;
      }
      // The rule decides whether the days overlap; this store passes every use of the same room by another session.
      if (otherSession.startsOn !== null && otherSession.endsOn !== null) {
        roomUses.push({
          sessionId: otherSession.id,
          label: otherSession.name,
          startsOn: otherSession.startsOn,
          endsOn: otherSession.endsOn,
        });
      }
    }

    return {
      session: days,
      person: {
        role: request.role,
        dateOfBirth: person.dateOfBirth,
        holdsRole:
          request.role === 'staff' ? person.roles.some(r => STAFF.includes(r)) : person.roles.includes('camper'),
      },
      group: {
        capacity: group.capacity,
        campers: inGroup.filter(a => a.role === 'camper').length,
        staff: inGroup.filter(a => a.role === 'staff').length,
        ratioCampers: group.ratioCampers,
        ageRange: group.ageRange,
      },
      room: { capacity: room.capacity, campers: roomCampers },
      roomUses,
    };
  }

  private requireSession(orgId: string, sessionId: string): InMemorySession {
    const session = this.sessions.get(sessionId);
    if (!session || session.orgId !== orgId) {
      throw new SessionNotFoundError();
    }

    return session;
  }

  private assertGroupName(orgId: string, sessionId: string, name: string, exceptId: string | null): void {
    const taken = [...this.groups.values()].some(
      g =>
        g.orgId === orgId &&
        g.sessionId === sessionId &&
        g.id !== exceptId &&
        g.name.toLowerCase() === name.toLowerCase(),
    );
    if (taken) {
      throw new NameTakenError('group');
    }
  }

  private assertRoomName(orgId: string, sessionId: string, name: string, exceptId: string | null): void {
    const taken = [...this.rooms.values()].some(
      r =>
        r.orgId === orgId &&
        r.sessionId === sessionId &&
        r.id !== exceptId &&
        r.name.toLowerCase() === name.toLowerCase(),
    );
    if (taken) {
      throw new NameTakenError('room');
    }
  }

  private groupView(g: GroupRecord): Group {
    const active = [...this.assignments.values()].filter(a => a.active && a.groupId === g.id);

    return {
      id: g.id,
      sessionId: g.sessionId,
      name: g.name,
      capacity: g.capacity,
      ratioCampers: g.ratioCampers,
      ageRange: g.ageRange,
      campers: active.filter(a => a.role === 'camper').length,
      staff: active.filter(a => a.role === 'staff').length,
    };
  }

  private roomView(r: RoomRecord): Room {
    const campers = [...this.assignments.values()].filter(
      a => a.active && a.roomId === r.id && a.role === 'camper',
    ).length;

    return { id: r.id, sessionId: r.sessionId, name: r.name, location: r.location, capacity: r.capacity, campers };
  }

  private assignmentView(a: AssignmentRecord): Assignment {
    const person = this.people.get(a.personId);

    return {
      id: a.id,
      sessionId: a.sessionId,
      personId: a.personId,
      personName: person?.name ?? '',
      role: a.role,
      groupId: a.groupId,
      roomId: a.roomId,
      overrideReason: a.overrideReason,
    };
  }
}
