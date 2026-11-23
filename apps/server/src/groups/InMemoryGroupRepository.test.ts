import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { groupRepositoryContract } from './groupRepository.contract';
import { InMemoryGroupRepository } from './InMemoryGroupRepository';

// The same contract the Postgres adapter runs (PgGroupRepository.pg.test.ts), so the in-memory store cannot drift from it.
groupRepositoryContract(() => {
  const repo = new InMemoryGroupRepository();
  const orgId = randomUUID();

  return Promise.resolve({
    repo,
    actor: { userId: randomUUID(), orgId, role: 'owner' },
    session: (startsOn, endsOn) => Promise.resolve(repo.seedSession({ orgId, startsOn, endsOn }).id),
    person: ({ dateOfBirth, roles }) =>
      Promise.resolve(repo.seedPerson({ orgId, dateOfBirth, roles: roles ?? ['camper'] }).id),
    close: () => Promise.resolve(),
  });
});

describe('InMemoryGroupRepository audit', () => {
  it('writes an entry for each change, in order', async () => {
    const repo = new InMemoryGroupRepository();
    const orgId = randomUUID();
    const actor = { userId: randomUUID(), orgId, role: 'owner' as const };
    const session = repo.seedSession({ orgId, startsOn: '2027-07-05', endsOn: '2027-07-17' });
    const person = repo.seedPerson({ orgId, dateOfBirth: '2019-01-01' });
    const group = await repo.createGroup(actor, session.id, {
      name: 'Hawks',
      capacity: 2,
      ratioCampers: null,
      ageRange: null,
    });
    const room = await repo.createRoom(actor, session.id, { name: 'Lodge 1', location: 'North', capacity: 4 });
    await repo.assign(
      actor,
      { sessionId: session.id, personId: person.id, role: 'camper', groupId: group.id, roomId: room.id },
      () => ({ kind: 'allow', overrode: null }),
    );

    expect(repo.audit.map(a => a.action)).toEqual(['group.create', 'room.create', 'assignment.create']);
  });
});
