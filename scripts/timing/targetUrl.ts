/** Hosts that count as this machine. Exact matches only, so `localhost.example.com` is remote. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** True when the URL is http or https and its host is this machine. */
export function isLocalUrl(raw: string): boolean {
  const url = parseHttpUrl(raw);

  return url !== null && LOCAL_HOSTS.has(url.hostname);
}

/**
 * The URL the timing script may measure, or an Error explaining why it refuses. A remote host is refused unless the caller
 * passed `allowRemote` (the operator's explicit choice). The message never echoes the URL's path or query, so nothing secret
 * placed there is printed.
 */
export function assertTargetUrl(raw: string, allowRemote: boolean): URL {
  const url = parseHttpUrl(raw);
  if (url === null) {
    throw new Error('The target must be an http:// or https:// URL.');
  }
  if (!LOCAL_HOSTS.has(url.hostname) && !allowRemote) {
    throw new Error(
      `Refusing to measure ${url.host}: it is not localhost. Pass --allow-remote to measure a deployed site on purpose.`,
    );
  }

  return url;
}

function parseHttpUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
}
