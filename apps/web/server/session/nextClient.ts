import 'server-only';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSessionClient } from './supabaseClient';

/**
 * The Supabase client for the current request, backed by the request's cookies. Null when Supabase is not configured.
 * Server Actions and Route Handlers may write cookies; a Server Component may not, so there the write is skipped
 * (`proxy.ts` has already refreshed the session cookies for the request).
 */
export async function requestSessionClient(): Promise<SupabaseClient | null> {
  const store = await cookies();
  return createSessionClient({
    getAll: () => store.getAll(),
    setAll(list) {
      try { for (const { name, value, options } of list) store.set(name, value, options); }
      catch { /* read-only context (Server Component render) */ }
    },
  });
}
