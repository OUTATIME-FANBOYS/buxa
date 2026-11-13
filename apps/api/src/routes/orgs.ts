import type { FastifyInstance } from 'fastify';
import { NewOrgInputSchema, OrgPatchInputSchema, type CreatedOrg, type Org, type OrgSummary } from '@buxa/contracts';
import { authorizedActor } from '../auth/orgScope';
import { requireSession } from '../auth/session';
import { conflict } from '../http/errors';
import { parseBody } from '../http/parse';
import { SlugTakenError, type OrgRepository } from '../orgs/OrgRepository';

export function orgRoutes(scope: FastifyInstance, deps: { orgs: OrgRepository }): void {
  scope.post('/orgs', async (req, reply): Promise<CreatedOrg> => {
    const input = parseBody(NewOrgInputSchema, req.body);
    try {
      const org = await deps.orgs.createWithOwner(input, requireSession(req).user.id);
      return reply.code(201).send(org);
    } catch (error) {
      throw error instanceof SlugTakenError ? conflict(error.message) : error;
    }
  });

  scope.get('/org', async (req): Promise<Org> => {
    const actor = authorizedActor(req, 'org:read');
    return deps.orgs.get(actor.orgId);
  });

  scope.patch('/org', async (req): Promise<OrgSummary> => {
    const actor = authorizedActor(req, 'org:update');
    return deps.orgs.rename(actor, parseBody(OrgPatchInputSchema, req.body));
  });
}
