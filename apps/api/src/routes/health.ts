import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

export function healthRoutes(app: FastifyInstance, deps: { pool: Pool }): void {
  /** Is the process up? Does not touch the database, so a DB outage does not restart healthy servers. */
  app.get('/health', async () => ({ status: 'ok' }));

  /** Can it serve traffic? Load balancers use this to stop routing to an instance without a database. */
  app.get('/ready', async (req, reply) => {
    try {
      await deps.pool.query('SELECT 1');
      return { status: 'ready' };
    } catch (err) {
      req.log.error({ err }, 'database not reachable');
      return reply.code(503).send({ status: 'unavailable' });
    }
  });
}
