/**
 * Whether Supabase makes people confirm their email before they get a session.
 *
 * We deliberately do NOT trust an `email_verified` flag inside the token: it lives in `user_metadata`, which the user can edit.
 * The reliable control is the project's "Confirm email" setting: when it is on, an unconfirmed account never receives a token.
 * This reads that setting from Supabase's public auth settings, so the API can refuse to run in production without it.
 */
export type EmailConfirmation = 'required' | 'not-required' | 'unknown';
export type StartupDecision = 'ok' | 'warn' | 'refuse';

export async function readEmailConfirmation(opts: { supabaseUrl: string; publishableKey: string; fetch?: typeof fetch }): Promise<EmailConfirmation> {
  const doFetch = opts.fetch ?? fetch;
  try {
    const response = await doFetch(`${opts.supabaseUrl.replace(/\/+$/, '')}/auth/v1/settings`, { headers: { apikey: opts.publishableKey }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return 'unknown';
    const settings: unknown = await response.json();
    const autoconfirm = (settings as { mailer_autoconfirm?: unknown } | null)?.mailer_autoconfirm;
    if (autoconfirm === true) return 'not-required';
    if (autoconfirm === false) return 'required';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Fail closed where it matters: production must not auto-confirm. A check that could not run only warns, so an outage at Supabase cannot take the API down. */
export function decideStartup(result: EmailConfirmation, nodeEnv: string): StartupDecision {
  if (result === 'required') return 'ok';
  if (result === 'not-required') return nodeEnv === 'production' ? 'refuse' : 'warn';
  return 'warn';
}
