import 'server-only';
import pg from 'pg';
import { createRemoteJWKSet } from 'jose';
import { decideStartup, readEmailConfirmation, type StartupDecision } from './auth/emailConfirmation';
import { createVerifier, type Verifier } from './auth/verifier';
import { loadConfig, type Config } from './config';
import { createLogger, type Logger } from './log';
import type { Clock } from './services';
import { createPgRepositories, type Repositories } from './repositories';
import {
  createAttendanceService, createCredentialService, createMembershipService, createOrgService, createPeopleService, systemClock,
  type AttendanceService, type CredentialService, type MembershipService, type OrgService, type PeopleService,
} from './services';

export interface Runtime {
  config: Config;
  log: Logger;
  pool: pg.Pool;
  repositories: Repositories;
  /** Undefined when Supabase is not configured; every authenticated route then answers 503. */
  verifier?: Verifier;
  services: Services;
  /**
   * Resolves once the start-up safety check has run. 'refuse' means the app must not serve: Supabase auto-confirms sign-ups in
   * production, so anyone could register with an address they do not own.
   */
  startupCheck: Promise<StartupDecision>;
}

export interface Services { orgs: OrgService; people: PeopleService; memberships: MembershipService; credentials: CredentialService; attendance: AttendanceService }

export interface RuntimeOptions {
  env?: Record<string, string | undefined>;
  /** Replace storage (tests use an in-memory one). */
  repositories?: Repositories;
  /** Replace the identity provider. `null` means none, even if the environment names one. */
  verifier?: Verifier | null;
  logSink?: (line: string) => void;
  /** Replace the clock (tests control "now" and so the camp's local day). */
  clock?: Clock;
}

/** Everything the server side needs, built from the environment. */
export function createRuntime(options: RuntimeOptions = {}): Runtime {
  const config = loadConfig(options.env ?? process.env);
  const log = createLogger(config.logLevel, options.logSink);
  const pool = new pg.Pool({ connectionString: config.databaseUrl, max: config.dbPoolMax, connectionTimeoutMillis: 5000 });
  const repositories = options.repositories ?? createPgRepositories(pool);
  const base = config.supabaseUrl?.replace(/\/+$/, '');

  const verifier: Verifier | undefined = options.verifier === null ? undefined : options.verifier
    ?? (base ? createVerifier({ issuer: `${base}/auth/v1`, keys: createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`)) }) : undefined);

  const startupCheck = (async (): Promise<StartupDecision> => {
    if (!base || options.verifier !== undefined) return 'ok';
    const confirmation = config.supabasePublishableKey ? await readEmailConfirmation({ supabaseUrl: base, publishableKey: config.supabasePublishableKey }) : 'unknown';
    const decision = decideStartup(confirmation, config.env);
    if (decision === 'refuse') log.fatal('Supabase is set to auto-confirm sign-ups. Turn on "Confirm email" (Authentication > Providers > Email) before running in production.');
    if (decision === 'warn') log.warn({ confirmation }, 'could not verify that Supabase requires email confirmation; check Authentication > Providers > Email');
    return decision;
  })();

  return { config, log, pool, repositories, verifier, services: createServices(repositories, options.clock ?? systemClock), startupCheck };
}

/** Services are built from repositories and a clock only, so tests can assemble them without a runtime. */
export function createServices(repositories: Repositories, clock: Clock): Services {
  const { orgs, people, memberships, credentials, attendance } = repositories;
  return {
    orgs: createOrgService(orgs),
    people: createPeopleService({ people, memberships, credentials, attendance, orgs, clock }),
    memberships: createMembershipService({ memberships, people, orgs, clock }),
    credentials: createCredentialService({ credentials, people, memberships, attendance, orgs, clock }),
    attendance: createAttendanceService({ attendance, people, memberships, orgs, clock }),
  };
}

// One runtime per server process. Kept on globalThis so Next.js hot reloading in development does not open a new pool every edit.
const SLOT = Symbol.for('buxa.runtime');
type Holder = { [SLOT]?: Runtime };

export function getRuntime(): Runtime {
  const holder = globalThis as Holder;
  return (holder[SLOT] ??= createRuntime());
}

/** Tests install their own runtime (or clear it with undefined). */
export function installRuntime(runtime: Runtime | undefined): void {
  (globalThis as Holder)[SLOT] = runtime;
}
