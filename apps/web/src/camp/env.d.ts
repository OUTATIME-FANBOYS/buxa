/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Public. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable (anon) key. Public by design; never put a secret key here. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Set to 'true' to let the original kanban demo sync with its old local server in a built app. Development always does. */
  readonly VITE_LEGACY_SYNC?: string;
}
