export type AuthMode = 'in' | 'up';
export type AuthErrors = Partial<Record<'name' | 'email' | 'pw' | 'form', string>>;

/** The sign-in / sign-up form is either being edited (with any messages to show) or waiting on a submit; never both. */
export type AuthForm =
  | { phase: 'editing'; mode: AuthMode; errors: AuthErrors }
  | { phase: 'submitting'; mode: AuthMode };

export type AuthFormEvent =
  | { type: 'switchMode' }
  | { type: 'invalid'; errors: AuthErrors }
  | { type: 'submitStarted' }
  | { type: 'finished'; message: string | null };

export const initialAuthForm: AuthForm = { phase: 'editing', mode: 'in', errors: {} };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAuth(mode: AuthMode, name: string, email: string, pw: string): AuthErrors {
  const er: AuthErrors = {};
  if (mode === 'up' && !name.trim()) er.name = 'Tell us what to call you.';
  if (!EMAIL.test(email.trim())) er.email = 'Enter a valid email address.';
  if (pw.length < (mode === 'up' ? 8 : 1)) er.pw = mode === 'up' ? 'Use at least 8 characters.' : 'Enter your password.';
  return er;
}

/** Events that do not fit the phase (a second submit while one is running, switching mode mid-submit) are ignored. */
export function authFormReducer(s: AuthForm, e: AuthFormEvent): AuthForm {
  switch (e.type) {
    case 'switchMode': return s.phase === 'editing' ? { phase: 'editing', mode: s.mode === 'in' ? 'up' : 'in', errors: {} } : s;
    case 'invalid': return s.phase === 'editing' ? { ...s, errors: e.errors } : s;
    case 'submitStarted': return s.phase === 'editing' ? { phase: 'submitting', mode: s.mode } : s;
    case 'finished': return s.phase === 'submitting' ? { phase: 'editing', mode: s.mode, errors: e.message ? { form: e.message } : {} } : s;
  }
}
