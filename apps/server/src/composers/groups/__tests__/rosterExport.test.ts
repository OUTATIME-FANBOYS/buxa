import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor, Role } from '@buxa/domain';
import type { Session } from '@buxa/contracts';
import { assertAllowed } from '../../../auth/authorize';
import { createGroupService, type GroupService } from '../../../groups/GroupService';
import { InMemoryGroupRepository } from '../../../groups/InMemoryGroupRepository';
import { loadRoster } from '../loadRoster';
import { rosterCsvResponse } from '../rosterResponse';

// The roster read and export, per role. The groups service is the real one over the in-memory store, so the placements and their
// permission checks are the production ones. The session read is a stand-in that applies the same events:read rule the classes
// service does (a teacher without an assigned class is refused) and scopes the session to the actor's camp.

interface SeededSession {
  id: string;
  orgId: string;
  name: string;
  startsOn: string | null;
  endsOn: string | null;
}

const h = vi.hoisted(() => ({
  actor: null as Actor | null,
  service: null as GroupService | null,
  sessions: [] as SeededSession[],
}));

vi.mock('../../../runtime', () => ({
  getRuntime: () => ({
    services: {
      groups: h.service,
      classes: {
        getSession: (actor: Actor, sessionId: string) => {
          assertAllowed(actor, 'events:read');
          const found = h.sessions.find(s => s.id === sessionId && s.orgId === actor.orgId);
          if (!found) {
            return Promise.resolve({
              ok: false as const,
              failure: { reason: 'session_not_found' as const, message: 'Not found.' },
            });
          }
          const session: Session = {
            id: found.id,
            name: found.name,
            description: '',
            startsOn: found.startsOn,
            endsOn: found.endsOn,
            classCount: 0,
            isPublic: false,
            createdAt: '2027-01-01T00:00:00.000Z',
            price: null,
          };

          return Promise.resolve({ ok: true as const, value: session });
        },
      },
    },
  }),
}));
vi.mock('../../people/camp', () => ({ currentActor: () => Promise.resolve(h.actor) }));

let repo: InMemoryGroupRepository;
let orgId: string;
let otherOrgId: string;
let staff: Actor;
let session: SeededSession;
let otherSession: SeededSession;

const actorIn = (role: Role, org?: string): Actor => ({ userId: randomUUID(), orgId: org ?? orgId, role });

async function placeOne(name: string, dateOfBirth: string, groupId: string, roomId: string) {
  const person = repo.seedPerson({ orgId, name, dateOfBirth });
  const outcome = await h.service?.assign(staff, {
    sessionId: session.id,
    personId: person.id,
    role: 'camper',
    groupId,
    roomId,
  });
  if (!outcome?.ok) {
    throw new Error('placement refused in test setup');
  }
}

beforeEach(async () => {
  repo = new InMemoryGroupRepository();
  orgId = randomUUID();
  otherOrgId = randomUUID();
  staff = actorIn('staff');
  session = repo.seedSession({ orgId, name: 'Summer 1', startsOn: '2027-07-05', endsOn: '2027-07-17' });
  otherSession = repo.seedSession({
    orgId: otherOrgId,
    name: 'Other camp',
    startsOn: '2027-07-05',
    endsOn: '2027-07-17',
  });
  h.sessions = [session, otherSession];
  h.service = createGroupService({ repo });

  const hawks = await h.service.createGroup(staff, session.id, {
    name: 'Hawks',
    capacity: 8,
    ratioCampers: null,
    ageRange: null,
  });
  const lodge = await h.service.createRoom(staff, session.id, { name: 'Lodge 1', location: 'North', capacity: 8 });
  if (!hawks.ok || !lodge.ok) {
    throw new Error('setup refused');
  }
  await placeOne('Ada Lovelace', '2019-01-01', hawks.value.id, lodge.value.id);
  await placeOne('Grace Hopper', '2018-06-01', hawks.value.id, lodge.value.id);
  h.actor = staff;
});

describe('loadRoster, per role', () => {
  it.each(['owner', 'admin', 'staff', 'viewer'] as const)(
    'lets %s read the roster grouped by group and room',
    async role => {
      const loaded = await loadRoster(actorIn(role), session.id);

      expect(loaded.ok).toBe(true);
      if (!loaded.ok) {
        return;
      }
      expect(loaded.value.roster.groups.map(g => g.name)).toEqual(['Hawks']);
      expect(loaded.value.roster.groups[0]?.rooms[0]?.members.map(m => m.name)).toEqual([
        'Ada Lovelace',
        'Grace Hopper',
      ]);
    },
  );

  it('gives a viewer only the names and roles the Assign board already shows, never birth dates or contact details', async () => {
    const loaded = await loadRoster(actorIn('viewer'), session.id);
    if (!loaded.ok) {
      throw new Error('viewer should read the roster');
    }
    const members = loaded.value.roster.groups.flatMap(g => g.rooms.flatMap(r => r.members));

    for (const member of members) {
      expect(Object.keys(member).sort()).toEqual(['name', 'personId', 'role']);
    }
    expect(JSON.stringify(loaded.value)).not.toContain('2019-01-01');
    expect(JSON.stringify(loaded.value)).not.toContain('2018-06-01');
  });

  it('refuses a teacher, who cannot read the placements', async () => {
    const loaded = await loadRoster(actorIn('teacher'), session.id);

    expect(loaded).toEqual({ ok: false, reason: 'forbidden' });
  });

  it('reports a session from another camp as not found, for every role', async () => {
    const loaded = await loadRoster(actorIn('owner'), otherSession.id);

    expect(loaded.ok).toBe(false);
    if (!loaded.ok) {
      expect(loaded.reason).toBe('not-found');
    }
  });
});

describe('rosterCsvResponse', () => {
  it('answers a UTF-8 CSV attachment with a byte-order mark for a staff member', async () => {
    const response = await rosterCsvResponse(session.id);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="roster-summer-1.csv"');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe(
      'Group,Room,Name,Role\r\nHawks,Lodge 1,Ada Lovelace,Camper\r\nHawks,Lodge 1,Grace Hopper,Camper\r\n',
    );
  });

  it('answers 403 to a teacher, with no roster in the body', async () => {
    h.actor = actorIn('teacher');
    const response = await rosterCsvResponse(session.id);

    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('Ada Lovelace');
  });

  it('answers 404 for a session from another camp', async () => {
    const response = await rosterCsvResponse(otherSession.id);

    expect(response.status).toBe(404);
  });

  it('answers 404 with no camp selected', async () => {
    h.actor = null;
    const response = await rosterCsvResponse(session.id);

    expect(response.status).toBe(404);
  });
});
