import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { Config } from './config';
import type { Verifier } from './auth/verifier';
import { registerV1 } from './routes/v1';

export interface AppDeps {
  config: Pick<Config, 'LOG_LEVEL' | 'NODE_ENV'>;
  pool: Pool;
  /** Without a verifier no /v1 routes exist, so a misconfigured deploy cannot serve unauthenticated data. */
  verifier?: Verifier;
  /** Tests pass a stream to read the logs. */
  logStream?: { write(line: string): void };
}

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Builds the HTTP app. No port is opened here, so tests can drive it with `app.inject`. */
export function buildApp({ config, pool, verifier, logStream }: AppDeps): FastifyInstance {
  const app = Fastify({
    bodyLimit: 1_048_576,
    // Keep a caller's request id only if it is plain and short; otherwise make one (stops log injection).
    requestIdHeader: false,
    genReqId: req => {
      const h = req.headers['x-request-id'];
      return typeof h === 'string' && SAFE_ID.test(h) ? h : randomUUID();
    },
    logger: {
      level: config.LOG_LEVEL,
      stream: logStream,
      // Never log headers, cookies or query strings: they carry tokens.
      serializers: {
        req: r => ({ method: r.method, path: r.url.split('?')[0] }),
        res: r => ({ statusCode: r.statusCode }),
      },
    },
  });

  app.addHook('onRequest', async (req, reply) => { reply.header('x-request-id', req.id); });
  app.addHook('onSend', async (_req, reply) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('cache-control', 'no-store');
    reply.header('x-frame-options', 'DENY');
  });

  const fail = (status: number, code: string, message: string, requestId: string) => ({ statusCode: status, body: { error: { code, message, requestId } } });
  const CODES: Record<number, string> = { 400: 'bad_request', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 409: 'conflict', 413: 'payload_too_large', 415: 'unsupported_media_type', 429: 'rate_limited' };

  app.setNotFoundHandler((req, reply) => {
    const f = fail(404, 'not_found', 'Route not found', req.id);
    return reply.code(f.statusCode).send(f.body);
  });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    const status = typeof err.statusCode === 'number' && err.statusCode >= 400 ? err.statusCode : 500;
    if (status >= 500) {
      req.log.error({ err }, 'unhandled error');
      const f = fail(500, 'internal', 'Something went wrong', req.id); // never leak internals
      return reply.code(f.statusCode).send(f.body);
    }
    const f = fail(status, CODES[status] ?? 'bad_request', err.message, req.id);
    return reply.code(f.statusCode).send(f.body);
  });

  /** Is the process up? Does not touch the database, so a DB outage does not restart healthy servers. */
  app.get('/health', async () => ({ status: 'ok' }));

  /** Can it serve traffic? Used by load balancers to stop routing to an instance without a database. */
  app.get('/ready', async (req, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ready' };
    } catch (err) {
      req.log.error({ err }, 'database not reachable');
      return reply.code(503).send({ status: 'unavailable' });
    }
  });

  if (verifier) registerV1(app, { pool, verifier });

  return app;
}
