import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/config';
import { hardenAll } from './cookies';

export interface CookieStore {
  getAll(): { name: string; value: string }[];
  setAll: SetAllCookies;
}

/**
 * A Supabase client that keeps its session in the cookies of `store` (HttpOnly: whatever the library asks to write is hardened first).
 * Make one per request. Null when Supabase is not configured.
 * The URL and publishable key come only from `publicEnv`.
 */
export function createSessionClient(store: CookieStore): SupabaseClient | null {
  const { supabaseUrl, supabasePublishableKey } = publicEnv;
  if (!supabaseUrl || !supabasePublishableKey) return null;
  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: { getAll: () => store.getAll(), setAll: (cookies, headers) => store.setAll(hardenAll(cookies), headers) },
  });
}
