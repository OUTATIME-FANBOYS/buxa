/**
 * Measures how long a scan takes on a running Buxa site, from the browser's side of the network, and prints p50, p95 and max.
 * It sends the scan Server Action the check-in screen sends when a badge is scanned. A scan only reads: it does not check anyone in.
 *
 *   npm run measure:checkin -- --url=http://localhost:3000 --token=bx1.<test badge>
 *   BUXA_SESSION_COOKIE='<Cookie header of a signed-in staff browser>' npm run measure:checkin -- --url=https://staging.example --token=bx1.<test badge> --allow-remote
 *
 * Options: --url (required), --token (required, a TEST badge), --runs (default 10, max 500), --allow-remote (required for any host
 * other than localhost), --action-id (only if the id cannot be found in the page's scripts). The token and the cookie are never
 * printed. Use a build made with `npm run build` and `npm run start`, not `next dev`, so the numbers mean something.
 * Read docs/phases/01-check-in-timing.md for the procedure on a real phone.
 */
import { findScanActionId } from './timing/actionId';
import { parseMeasureOptions, type MeasureOptions } from './timing/options';
import { formatSummary, summarize } from '@buxa/shared/timing/stats';

/** The page the check-in screen lives on (apps/web/config/routes.ts, `checkIn`). */
const CHECK_IN_PATH = '/camp/check-in';
const REQUEST_TIMEOUT_MS = 10_000;
const PHONE_BUDGET_SECONDS = 5;

async function getText(url: URL, cookie: string | null): Promise<string> {
  const response = await fetch(url, {
    headers: cookie ? { Cookie: cookie } : {},
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Could not load ${url.pathname}: HTTP ${response.status}.`);
  return response.text();
}

/** The scan action's id, read from the check-in page's own scripts (same origin only). */
async function discoverActionId(options: MeasureOptions): Promise<string> {
  const page = new URL(CHECK_IN_PATH, options.url);
  const html = await getText(page, options.sessionCookie);
  const sources = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
    .map(match => new URL(match[1].replace(/&amp;/g, '&'), page))
    .filter(src => src.origin === page.origin);
  for (const src of sources) {
    const id = findScanActionId(await getText(src, options.sessionCookie));
    if (id !== null) return id;
  }
  throw new Error('Could not find the scan action in the check-in page. Pass --action-id with the id from the build, or see the procedure.');
}

/** One scan, as the check-in screen sends it. Returns the status and the elapsed time; the body is only checked, never printed. */
async function scanOnce(options: MeasureOptions, actionId: string): Promise<{ elapsedMs: number; ok: boolean; status: number }> {
  const started = performance.now();
  const response = await fetch(new URL(CHECK_IN_PATH, options.url), {
    method: 'POST',
    headers: {
      'Next-Action': actionId,
      'Content-Type': 'text/plain;charset=UTF-8',
      Accept: 'text/x-component',
      ...(options.sessionCookie ? { Cookie: options.sessionCookie } : {}),
    },
    body: JSON.stringify([{ raw: options.token }]),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await response.text();
  const elapsedMs = performance.now() - started;
  // The action answers with the person's card when the badge is valid; a refusal or a sign-in problem does not contain it.
  return { elapsedMs, ok: response.status === 200 && body.includes('"kind":"person"'), status: response.status };
}

async function main(): Promise<void> {
  const options = parseMeasureOptions(process.argv.slice(2), process.env);
  const target = `${options.url.origin}${CHECK_IN_PATH}`;
  console.log(`Measuring scans on ${target}: ${options.runs} runs, one test badge.`);

  const actionId = options.actionId ?? await discoverActionId(options);
  const warm = await scanOnce(options, actionId);
  if (!warm.ok) {
    throw new Error(`The warm-up scan failed (HTTP ${warm.status}). Check the test badge is valid and that BUXA_SESSION_COOKIE is a signed-in staff session.`);
  }

  const samples: number[] = [];
  for (let run = 1; run <= options.runs; run++) {
    const result = await scanOnce(options, actionId);
    if (!result.ok) throw new Error(`Scan ${run} failed (HTTP ${result.status}). The run is stopped so the numbers are not misleading.`);
    samples.push(result.elapsedMs);
  }

  const summary = summarize(samples);
  console.log(formatSummary('scan to response (browser)', summary));
  console.log(`Phone budget: ${PHONE_BUDGET_SECONDS} s from scan to the green result, on a real phone. This number is only the network and server part.`);
}

main().catch((error: unknown) => {
  // Only the message is printed: it names the step, never the badge or the cookie.
  const message = error instanceof Error ? error.message : 'The measurement failed.';
  console.error(message === 'fetch failed' ? 'Could not reach the site. Is it running at that address?' : message);
  process.exitCode = 1;
});
