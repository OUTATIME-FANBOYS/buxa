import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Null when the public Supabase settings are missing; the app then shows a setup page instead of failing. */
export function createSupabaseClient(env: ImportMetaEnv): SupabaseClient | null {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url.replace(/\/+$/, ''), key, { auth: { persistSession: true, autoRefreshToken: true } });
}

export const supabase = createSupabaseClient(import.meta.env);
