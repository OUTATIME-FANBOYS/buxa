import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Null when the public Supabase settings are missing; the app then shows a setup page instead of failing. */
export const supabase = url && key
  ? createClient(url.replace(/\/+$/, ''), key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
