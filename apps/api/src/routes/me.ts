import type { FastifyInstance } from 'fastify';
import type { Me } from '@buxa/contracts';
import { requireSession } from '../auth/session';

export function meRoutes(scope: FastifyInstance): void {
  scope.get('/me', async (req): Promise<Me> => {
    const { user, memberships } = requireSession(req);
    return { user, orgs: [...memberships] };
  });
}
