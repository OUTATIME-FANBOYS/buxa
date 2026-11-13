import type { FastifyError, FastifyInstance } from 'fastify';
import { errorBody } from './errors';

/** What every response gets regardless of route: the request id, security headers, and the one error shape. */
export function registerHttpBasics(app: FastifyInstance): void {
  app.addHook('onRequest', async (req, reply) => { reply.header('x-request-id', req.id); });
  app.addHook('onSend', async (_req, reply) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('cache-control', 'no-store');
    reply.header('x-frame-options', 'DENY');
  });

  app.setNotFoundHandler((req, reply) => reply.code(404).send(errorBody(404, 'Route not found', req.id)));

  app.setErrorHandler((error: FastifyError, req, reply) => {
    const status = typeof error.statusCode === 'number' && error.statusCode >= 400 ? error.statusCode : 500;
    if (status >= 500) {
      req.log.error({ err: error }, 'unhandled error');
      return reply.code(500).send(errorBody(500, 'Something went wrong', req.id)); // never leak internals
    }
    return reply.code(status).send(errorBody(status, error.message, req.id));
  });
}
