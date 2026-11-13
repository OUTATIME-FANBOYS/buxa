import type { FastifyInstance } from 'fastify';
import type { Members } from '@buxa/contracts';
import { authorizedActor } from '../auth/orgScope';
import type { OrgRepository } from '../orgs/OrgRepository';

export function memberRoutes(scope: FastifyInstance, deps: { orgs: OrgRepository }): void {
  scope.get('/members', async (req): Promise<Members> => {
    const actor = authorizedActor(req, 'members:read');
    return { members: await deps.orgs.listMembers(actor.orgId) };
  });
}
