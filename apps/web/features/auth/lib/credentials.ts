import type { FieldErrors } from '@/lib/actions/state';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_NEW_PASSWORD = 8;

export type CredentialField = 'name' | 'email' | 'password';
export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors<CredentialField> };

const text = (data: FormData, key: string): string => { const value = data.get(key); return typeof value === 'string' ? value : ''; };
const failed = (errors: FieldErrors<CredentialField>): boolean => Object.keys(errors).length > 0;

export interface SignInInput { email: string; password: string }
export interface SignUpInput extends SignInInput { name: string }

export function parseSignIn(data: FormData): Parsed<SignInInput> {
  const email = text(data, 'email').trim();
  const password = text(data, 'password');
  const errors: FieldErrors<CredentialField> = {};
  if (!EMAIL.test(email)) errors.email = 'Enter a valid email address.';
  if (password.length < 1) errors.password = 'Enter your password.';
  return failed(errors) ? { ok: false, errors } : { ok: true, value: { email, password } };
}

export function parseSignUp(data: FormData): Parsed<SignUpInput> {
  const name = text(data, 'name').trim();
  const email = text(data, 'email').trim();
  const password = text(data, 'password');
  const errors: FieldErrors<CredentialField> = {};
  if (!name) errors.name = 'Tell us what to call you.';
  if (!EMAIL.test(email)) errors.email = 'Enter a valid email address.';
  if (password.length < MIN_NEW_PASSWORD) errors.password = `Use at least ${MIN_NEW_PASSWORD} characters.`;
  return failed(errors) ? { ok: false, errors } : { ok: true, value: { name, email, password } };
}
