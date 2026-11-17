import type { PoolConfig } from 'pg';
import { SUPABASE_ROOT_CA_2021 } from './supabaseRootCa';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * The pg pool settings for a database URL. Remote databases (Supabase) are checked against the Supabase root CA; the
 * sslmode in the URL is removed, because pg would otherwise override this check. Local databases use no TLS.
 */
export function poolConfigFor(connectionString: string, extra: Omit<PoolConfig, 'connectionString' | 'ssl'> = {}): PoolConfig {
  const url = new URL(connectionString);
  const local = LOCAL_HOSTS.has(url.hostname);
  url.searchParams.delete('sslmode');
  url.searchParams.delete('uselibpqcompat');
  return {
    ...extra,
    connectionString: url.toString(),
    ssl: local ? false : { ca: SUPABASE_ROOT_CA_2021, rejectUnauthorized: true },
  };
}
