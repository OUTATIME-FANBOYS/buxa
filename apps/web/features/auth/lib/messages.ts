/** What to tell a person when Supabase refuses. Deliberately general: never says whether an email already has an account. */
export function describeSignInError(message: string): string {
  if (/email not confirmed/i.test(message)) return 'Confirm your email first. Check your inbox for the link.';
  if (/invalid login|invalid credentials/i.test(message)) return 'That email and password do not match.';
  if (/rate|too many|limit/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
  return 'Could not sign in. Please try again.';
}

export function describeSignUpError(message: string): string {
  if (/password/i.test(message)) return 'Choose a stronger password (at least 8 characters).';
  if (/rate|too many|limit/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
  return 'Could not create the account. Please try again.';
}

/** Shown after every sign-up that did not sign the person in, whether or not the address was already registered. */
export const CONFIRM_EMAIL_MESSAGE = 'Check your email for a confirmation link, then sign in.';
