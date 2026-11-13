import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { Verifier } from './auth/verifier';
import type { Config } from './config';
import { registerHttpBasics } from './http/basics';
import { generateRequestId } from './http/requestId';
import { createPgRepositories, type Repositories } from './repositories';
import { healthRoutes } from './routes/health';
import { registerV1 } from './routes/v1';

export interface AppDeps {
  config: Pick<Config, 'LOG_LEVEL' | 'NODE_ENV'>;
  pool: Pool;
  /** Without a verifier no /v1 routes exist, so a misconfigured deploy cannot serve unauthenticated data. */
  verifier?: Verifier;
  /** Defaults to Postgres. Tests can pass in-memory ones. */
  repositories?: Repositories;
  /** Tests pass a stream to read the logs. */
  logStream?: { write(line: string): void };
}

/** Builds the HTTP app. No port is opened here, so tests can drive it with `app.inject`. */
export function buildApp({ config, pool, verifier, repositories = createPgRepositories(pool), logStream }: AppDeps): FastifyInstance {
  const app = Fastify({
    bodyLimit: 1_048_576,
    requestIdHeader: false,
    genReqId: generateRequestId,
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

  registerHttpBasics(app);
  healthRoutes(app, { pool });
  if (verifier) registerV1(app, { verifier, repositories });
  return app;
}
