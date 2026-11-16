const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Refuses to seed anything but a database on this machine. The URL's host is checked, and so is a `host` query parameter
 * (the Postgres driver lets it override the host), so a remote database cannot be reached by either route.
 */
export function assertLocalDatabase(url: string | undefined): void {
  if (!url) throw new Error('DATABASE_URL is not set. Point it at the local database (see docker-compose.yml).');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('DATABASE_URL is not a valid URL.'); }
  const overridden = parsed.searchParams.get('host');
  const hosts = [parsed.hostname, ...(overridden === null ? [] : [overridden])];
  const remote = hosts.find(host => !LOCAL_HOSTS.has(host));
  if (remote !== undefined) {
    throw new Error(`Refusing to seed: DATABASE_URL points at "${remote}", not localhost. The mock seed only runs against a local database.`);
  }
}
