import 'server-only';
import { headers } from 'next/headers';

/**
 * The address the invite link is built from: the scheme and host the browser used to reach this app. A proxy's forwarded
 * headers win when present. The link is shown only to the person who sent the invite, so the origin is never trusted for
 * anything else.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host =
    (h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000').split(',')[0]?.trim() ?? 'localhost:3000';
  const proto = (h.get('x-forwarded-proto') ?? 'http').split(',')[0]?.trim() ?? 'http';

  return `${proto}://${host}`;
}
