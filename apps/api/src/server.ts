import pg from 'pg';
import { buildApp } from './app';
import { createRemoteJWKSet } from 'jose';
import { createVerifier } from './auth/verifier';
import { loadConfig } from './config';

let config;
try { config = loadConfig(); } catch (e) { console.error((e as Error).message); process.exit(1); }

const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
const base = config.SUPABASE_URL?.replace(/\/+$/, '');
const verifier = base
  ? createVerifier({ issuer: `${base}/auth/v1`, keys: createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`)) })
  : undefined;
const app = buildApp({ config, pool, verifier });

// Finish in-flight requests, then release the database, so deploys do not drop work.
let closing = false;
async function shutdown(signal: string) {
  if (closing) return; closing = true;
  app.log.info({ signal }, 'shutting down');
  try { await app.close(); await pool.end(); process.exit(0); }
  catch (e) { app.log.error({ err: e }, 'shutdown failed'); process.exit(1); }
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

app.listen({ port: config.PORT, host: config.HOST }).catch(e => { app.log.error({ err: e }, 'failed to start'); process.exit(1); });
