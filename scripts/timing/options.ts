import { parseCredentialPayload } from '@buxa/domain';
import { assertTargetUrl } from './targetUrl';

export const DEFAULT_RUNS = 10;
const MAX_RUNS = 500;

export interface MeasureOptions {
  /** The origin and path the check-in page is served from. Already checked by the localhost guard. */
  url: URL;
  /** The test badge payload (`bx1.` + token). Only ever sent to the server; never printed. */
  token: string;
  runs: number;
  allowRemote: boolean;
  /** A scan action id given by hand, when the script should not look for it in the page's scripts. */
  actionId: string | null;
  /** The browser's Cookie header for a signed-in staff session, from the environment so it stays out of the shell history. */
  sessionCookie: string | null;
}

/**
 * Reads `--url`, `--token`, `--runs`, `--allow-remote` and `--action-id` (each also as `--name=value`). The session cookie comes
 * from BUXA_SESSION_COOKIE. Errors name the option, never the token's value.
 */
export function parseMeasureOptions(argv: readonly string[], env: Record<string, string | undefined>): MeasureOptions {
  const values = new Map<string, string>();
  let allowRemote = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--allow-remote') {
      allowRemote = true;
      continue;
    }
    const match = /^--(url|token|runs|action-id)(?:=(.*))?$/.exec(arg);
    if (!match) throw new Error(`Unknown option ${arg.startsWith('--') ? arg.split('=')[0] : 'argument'}. See the usage in scripts/measure-checkin.ts.`);
    const value = match[2] ?? argv[++i];
    if (value === undefined || value === '' || value.startsWith('--')) throw new Error(`${match[1] === 'token' ? '--token' : `--${match[1]}`} needs a value.`);
    values.set(match[1], value);
  }

  const url = values.get('url');
  if (url === undefined) throw new Error('Give the site to measure with --url, for example --url=http://localhost:3000');
  const token = values.get('token');
  if (token === undefined) throw new Error('Give a test badge with --token (the bx1. code from a test person, not a real member).');
  if (parseCredentialPayload(token) === null) throw new Error('That is not a Buxa badge code: it should start with bx1. and be the code printed on the test badge.');

  const runs = values.has('runs') ? Number(values.get('runs')) : DEFAULT_RUNS;
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_RUNS) throw new Error(`--runs must be a whole number from 1 to ${MAX_RUNS}.`);

  const actionId = values.get('action-id') ?? null;
  if (actionId !== null && !/^[0-9a-f]{40,}$/.test(actionId)) throw new Error('--action-id must be the hexadecimal id of the scan action.');

  return {
    url: assertTargetUrl(url, allowRemote),
    token: token.trim(),
    runs,
    allowRemote,
    actionId,
    sessionCookie: env.BUXA_SESSION_COOKIE?.trim() || null,
  };
}
