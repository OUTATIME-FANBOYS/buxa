/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Public. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable (anon) key. Public by design; never put a secret key here. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
