/**
 * The public settings, read once. They are safe to ship to the browser, and the server uses the same values, so the Supabase address
 * and key are set in exactly one place. Next.js only inlines NEXT_PUBLIC_* variables it can see written out in full, hence the literals.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
} as const;
