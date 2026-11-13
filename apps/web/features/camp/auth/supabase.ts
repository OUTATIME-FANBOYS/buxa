import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/config/env';

const inBrowser = typeof window !== 'undefined';

/** Null when the public Supabase settings are missing; the app then shows a setup page instead of failing. */
export function createSupabaseClient(url: string | undefined, publishableKey: string | undefined): SupabaseClient | null {
  if (!url || !publishableKey) return null;
  // Sessions live in the browser. While Next.js pre-renders on the server there is no storage to read or timer to run.
  return createClient(url.replace(/\/+$/, ''), publishableKey, { auth: { persistSession: inBrowser, autoRefreshToken: inBrowser } });
}

export const supabase = createSupabaseClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey);
