/**
 * Which smoke-test failures a job without a database may accept. Pure, so the rule is unit tested.
 *
 * - `/ready` answers 503 when no database is configured (it reports database health).
 * - The public session page reads the database for anonymous visitors. Without a database it answers 500, which is accepted
 *   only when the job declares that no database is available (SMOKE_NO_DATABASE=1). The database job cannot run this check
 *   over HTTP (it does not build the web app), so the page's data path is covered by the database tests instead.
 */
export interface SmokeOutcome {
  url: string;
  file: string;
  status: number;
}

const PUBLIC_SESSION_PAGE = 'camps/[slug]/sessions/[sessionId]/page.tsx';

export function isAcceptedFailure(outcome: SmokeOutcome, noDatabase: boolean): boolean {
  if (outcome.url === '/ready' && outcome.status === 503) {
    return true;
  }

  return noDatabase && outcome.status === 500 && outcome.file.endsWith(PUBLIC_SESSION_PAGE);
}

/** True when the job said, with SMOKE_NO_DATABASE=1, that no database is available to the web app. */
export function noDatabaseDeclared(env: NodeJS.ProcessEnv): boolean {
  return env.SMOKE_NO_DATABASE === '1';
}
