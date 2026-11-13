import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { createRemoteJWKSet } from 'jose';
import { buildApp } from './app';
import { decideStartup, readEmailConfirmation, type StartupDecision } from './auth/emailConfirmation';
import { createVerifier, type Verifier } from './auth/verifier';
import { loadConfig, type Config } from './config';

export interface Runtime {
  app: FastifyInstance;
  pool: pg.Pool;
  config: Config;
  /**
   * Resolves once the start-up safety check has run. 'refuse' means the app must not serve (Supabase auto-confirms sign-ups
   * in production); the caller decides how: the local server exits, the Vercel function answers 503.
   */
  startupCheck: Promise<StartupDecision>;
}

/** Everything the API needs, built from the environment. Shared by the local server and the Vercel function. */
export function createRuntime(env: NodeJS.ProcessEnv = process.env): Runtime {
  const config = loadConfig(env);
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: config.DB_POOL_MAX, connectionTimeoutMillis: 5000 });
  const base = config.SUPABASE_URL?.replace(/\/+$/, '');
  const verifier: Verifier | undefined = base
    ? createVerifier({ issuer: `${base}/auth/v1`, keys: createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`)) })
    : undefined;
  const app = buildApp({ config, pool, verifier });

  const publishableKey = config.SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const startupCheck = (async (): Promise<StartupDecision> => {
    if (!base) return 'ok';
    // Without email confirmation anyone could sign up with an address they do not own. Refuse to serve that way in production.
    const confirmation = publishableKey ? await readEmailConfirmation({ supabaseUrl: base, publishableKey }) : 'unknown';
    const decision = decideStartup(confirmation, config.NODE_ENV);
    if (decision === 'refuse') app.log.fatal('Supabase is set to auto-confirm sign-ups. Turn on "Confirm email" (Authentication > Providers > Email) before running in production.');
    if (decision === 'warn') app.log.warn({ confirmation }, 'could not verify that Supabase requires email confirmation; check Authentication > Providers > Email');
    return decision;
  })();

  return { app, pool, config, startupCheck };
}
