import pg from 'pg';
import { createRemoteJWKSet } from 'jose';
import { buildApp } from './app';
import { decideStartup, readEmailConfirmation } from './auth/emailConfirmation';
import { createVerifier } from './auth/verifier';
import { loadConfig } from './config';

async function startServer(): Promise<void> {
  let config;
  try { config = loadConfig(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exit(1); }

  const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: config.DB_POOL_MAX, connectionTimeoutMillis: 5000 });
  const base = config.SUPABASE_URL?.replace(/\/+$/, '');
  const verifier = base
    ? createVerifier({ issuer: `${base}/auth/v1`, keys: createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`)) })
    : undefined;
  const app = buildApp({ config, pool, verifier });

  // Without email confirmation anyone could sign up with an address they do not own. Refuse to run that way in production.
  const publishableKey = config.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (base) {
    const confirmation = publishableKey ? await readEmailConfirmation({ supabaseUrl: base, publishableKey }) : 'unknown';
    const decision = decideStartup(confirmation, config.NODE_ENV);
    if (decision === 'refuse') { app.log.fatal('Supabase is set to auto-confirm sign-ups. Turn on "Confirm email" (Authentication > Providers > Email) before running in production.'); process.exit(1); }
    if (decision === 'warn') app.log.warn({ confirmation }, 'could not verify that Supabase requires email confirmation; check Authentication > Providers > Email');
  }

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

startServer().catch(error => { console.error(error); process.exit(1); });
