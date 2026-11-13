import type { FastifyInstance } from 'fastify';
import { requireAuthentication } from '../auth/authentication';
import type { Verifier } from '../auth/verifier';
import type { Repositories } from '../repositories';
import { memberRoutes } from './members';
import { meRoutes } from './me';
import { orgRoutes } from './orgs';

/** Everything under /v1. Every route here requires a signed-in user. */
export function registerV1(app: FastifyInstance, deps: { verifier: Verifier; repositories: Repositories }): void {
  app.register(async v1 => {
    requireAuthentication(v1, { verifier: deps.verifier, users: deps.repositories.users });
    meRoutes(v1);
    orgRoutes(v1, deps.repositories);
    memberRoutes(v1, deps.repositories);
  }, { prefix: '/v1' });
}
