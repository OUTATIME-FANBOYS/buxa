import { randomUUID } from 'node:crypto';
import type { Actor } from '@buxa/domain';
import { createInMemoryRepositories } from '../../__tests__/fakes';
import type { RepositoryFixture } from './fixture';
import { settle } from '@buxa/domain';

/** Two organisations with random ids, in memory. Nothing to clean up. */
export function createMemoryFixture(): Promise<RepositoryFixture> {
  return settle(() => {
    const repos = createInMemoryRepositories();
    const actor: Actor = { userId: randomUUID(), orgId: randomUUID(), role: 'owner' };
    const otherActor: Actor = { userId: randomUUID(), orgId: randomUUID(), role: 'owner' };

    return {
      repos,
      actor,
      otherActor,
      auditActions: () => settle(() => repos.audit.filter(a => a.orgId === actor.orgId).map(a => a.action)),
      close: () => settle(() => undefined),
    };
  });
}
