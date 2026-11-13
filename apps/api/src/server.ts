import pg from 'pg';
import { createRemoteJWKSet } from 'jose';
import { buildApp } from './app';
import { createVerifier } from './auth/verifier';
import { loadConfig } from './config';

function startServer(): void {
  let config;
  try { config = loadConfig(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exit(1); }

  const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
  const base = config.SUPABASE_URL?.replace(/\/+$/, '');
  const verifier = base
    ? createVerifier({ issuer: `${base}/auth/v1`, keys: createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`)) })
    : undefined;
  const app = buildApp({ config, pool, verifier });

  // Finish in-flight requests, then release the database, so deploys do not drop work. Runs once however many signals arrive.
  let shutdown: Promise<void> | undefined;
  const stop = (signal: string): Promise<void> => (shutdown ??= (async () => {
    app.log.info({ signal }, 'shutting down');
    try { await app.close(); await pool.end(); process.exit(0); }
    catch (error) { app.log.error({ err: error }, 'shutdown failed'); process.exit(1); }
  })());
  process.on('SIGTERM', () => void stop('SIGTERM'));
  process.on('SIGINT', () => void stop('SIGINT'));

  app.listen({ port: config.PORT, host: config.HOST }).catch(error => { app.log.error({ err: error }, 'failed to start'); process.exit(1); });
}

startServer();
