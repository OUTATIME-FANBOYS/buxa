import 'server-only';
import pg from 'pg';
import { poolConfigFor } from '@buxa/db';
import { createRemoteJWKSet } from 'jose';
import { decideStartup, readEmailConfirmation, type StartupDecision } from './auth/emailConfirmation';
import { createVerifier, type Verifier } from './auth/verifier';
import { loadConfig, type Config } from './config';
import { createLogger, type Logger } from './log';
import { createPgRateLimiter, type RateLimiter } from './rateLimit/limiter';
import type { Clock } from './services/clock';
import { createPgRepositories, type Repositories } from './repositories';
import { createAttendanceService } from './services/attendance/createAttendanceService';
import { createClassService, type ClassService } from './classes/ClassService';
import { createSeatHoldService, type SeatHoldService } from './holds/SeatHoldService';
import { createCalendarService, type CalendarService } from './calendar/CalendarService';
import { createPublicSessionService, type PublicSessionService } from './publicSessions/PublicSessionService';
import { createCredentialService } from './services/credentials/createCredentialService';
import { badgeCipher } from './credentials/badgeCipher';
import { createImportService, type ImportService } from './classes/import/ImportService';
import { createGroupService, type GroupService } from './groups/GroupService';
import { createMembershipService } from './services/memberships/createMembershipService';
import { createOrgService, type OrgService } from './services/orgs';
import { createPeopleService } from './services/people/createPeopleService';
import { createRegistrationService, type RegistrationService } from './registration/RegistrationService';
import { systemClock } from './services/clock';
import { type AttendanceService } from './services/attendance/AttendanceService';
import { type CredentialService } from './services/credentials/CredentialService';
import { type MembershipService } from './services/memberships/MembershipService';
import { type PeopleService } from './services/people/PeopleService';
import { createInviteService } from './services/invites/createInviteService';
import { type InviteService } from './services/invites/InviteService';

export interface Runtime {
  config: Config;
  log: Logger;
  pool: pg.Pool;
  repositories: Repositories;
  /** Undefined when Supabase is not configured; every authenticated route then answers 503. */
  verifier?: Verifier;
  services: Services;
  /** Shared request limits (see rateLimit/limiter.ts). Counted in Postgres, so every instance agrees. */
  rateLimiter: RateLimiter;
  /**
   * Resolves once the start-up safety check has run. 'refuse' means the app must not serve: Supabase auto-confirms sign-ups in
   * production, so anyone could register with an address they do not own.
   */
  startupCheck: Promise<StartupDecision>;
}

export interface Services {
  orgs: OrgService;
  people: PeopleService;
  memberships: MembershipService;
  credentials: CredentialService;
  attendance: AttendanceService;
  classes: ClassService;
  imports: ImportService;
  /** Groups, rooms and assignments for a session. Every placement runs the capacity, age, ratio and room rules. */
  groups: GroupService;
  registration: RegistrationService;
  /** Seat holds for registration. The form calls placeHold; the cleanup calls releaseExpiredHolds. */
  seatHolds: SeatHoldService;
  calendar: CalendarService;
  publicSessions: PublicSessionService;
  /** Teacher invites: a staff member invites a teacher by email, and the teacher joins with the link. */
  invites: InviteService;
}

export interface RuntimeOptions {
  env?: Record<string, string | undefined>;
  /** Replace storage (tests use an in-memory one). */
  repositories?: Repositories;
  /** Replace the identity provider. `null` means none, even if the environment names one. */
  verifier?: Verifier | null;
  logSink?: (line: string) => void;
  /** Replace the clock (tests control "now" and so the camp's local day). */
  clock?: Clock;
  /** Replace the request limiter (tests use the in-memory one). */
  rateLimiter?: RateLimiter;
}

/** Everything the server side needs, built from the environment. */
export function createRuntime(options: RuntimeOptions = {}): Runtime {
  const config = loadConfig(options.env ?? process.env);
  const log = createLogger(config.logLevel, options.logSink);
  const pool = new pg.Pool(poolConfigFor(config.databaseUrl, { max: config.dbPoolMax, connectionTimeoutMillis: 5000 }));
  const repositories = options.repositories ?? createPgRepositories(pool);
  const rateLimiter = options.rateLimiter ?? createPgRateLimiter(pool);
  const base = config.supabaseUrl?.replace(/\/+$/, '');

  const verifier: Verifier | undefined =
    options.verifier === null
      ? undefined
      : (options.verifier ??
        (base
          ? createVerifier({
              issuer: `${base}/auth/v1`,
              keys: createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`)),
            })
          : undefined));

  const startupCheck = (async (): Promise<StartupDecision> => {
    if (!base || options.verifier !== undefined) {
      return 'ok';
    }
    const confirmation = config.supabasePublishableKey
      ? await readEmailConfirmation({ supabaseUrl: base, publishableKey: config.supabasePublishableKey })
      : 'unknown';
    const decision = decideStartup(confirmation, config.env);
    if (decision === 'refuse') {
      log.fatal(
        'Supabase is set to auto-confirm sign-ups. Turn on "Confirm email" (Authentication > Providers > Email) before running in production.',
      );
    }
    if (decision === 'warn') {
      log.warn(
        { confirmation },
        'could not verify that Supabase requires email confirmation; check Authentication > Providers > Email',
      );
    }

    return decision;
  })();

  return {
    config,
    log,
    pool,
    repositories,
    verifier,
    rateLimiter,
    services: createServices(repositories, options.clock ?? systemClock),
    startupCheck,
  };
}

/** Services are built from repositories and a clock only, so tests can assemble them without a runtime. */
export function createServices(repositories: Repositories, clock: Clock): Services {
  const { orgs, people, memberships, credentials, attendance, classes } = repositories;

  return {
    orgs: createOrgService(orgs),
    people: createPeopleService({ people, memberships, credentials, attendance, classes, orgs, clock }),
    memberships: createMembershipService({ memberships, people, classes, orgs, clock }),
    credentials: createCredentialService({
      credentials,
      people,
      memberships,
      attendance,
      orgs,
      clock,
      cipher: badgeCipher,
    }),
    attendance: createAttendanceService({
      attendance,
      classes,
      groups: repositories.groups,
      people,
      memberships,
      orgs,
      clock,
    }),
    ...createClassServices(repositories),
    registration: createRegistrationService(repositories.registration, badges =>
      createCredentialService({
        credentials: badges,
        people,
        memberships,
        attendance,
        orgs,
        clock,
        cipher: badgeCipher,
      }),
    ),
    calendar: createCalendarService({ repo: repositories.calendar }),
    publicSessions: createPublicSessionService({ repo: repositories.publicSessions }),
    invites: createInviteService({ invites: repositories.memberInvites }),
  };
}

/** Classes, sessions, enrolments and the bulk import. Both storages come from `repositories` (Postgres in production). */
function createClassServices(
  repositories: Repositories,
): Pick<Services, 'classes' | 'imports' | 'seatHolds' | 'groups'> {
  const timezoneOf = async (scope: { userId: string; orgId: string }): Promise<string> =>
    (await repositories.orgs.get(scope.userId, scope.orgId)).timezone;
  const holdMinutesOf = async (scope: { userId: string; orgId: string }): Promise<number | null> =>
    (await repositories.orgs.get(scope.userId, scope.orgId)).holdMinutes;
  const classes = repositories.classes;

  return {
    seatHolds: createSeatHoldService({ repo: repositories.seatHolds, classes, timezoneOf, holdMinutesOf }),
    groups: createGroupService({ repo: repositories.groups }),
    classes: createClassService({ repo: classes, timezoneOf }),
    imports: createImportService({ classes, imports: repositories.imports, timezoneOf }),
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
