/**
 * @deprecated The `@buxa/contracts` schemas are now the validators (see features/camp/actions/input.ts). Kept only because the old
 * screens (rewritten by B1/A1) still import it; the integrator deletes it together with them.
 */
import { NewOrgInputSchema, OrgPatchInputSchema } from '@buxa/contracts';
import type { ZodType } from 'zod';
import type { FieldErrors } from './submission';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_NEW_PASSWORD = 8;

export type AuthMode = 'in' | 'up';
export interface SignInFields { name: string; email: string; password: string }

export function validateSignIn(mode: AuthMode, fields: SignInFields): FieldErrors<keyof SignInFields> {
  const errors: FieldErrors<keyof SignInFields> = {};
  if (mode === 'up' && !fields.name.trim()) errors.name = 'Tell us what to call you.';
  if (!EMAIL.test(fields.email.trim())) errors.email = 'Enter a valid email address.';
  if (mode === 'up' ? fields.password.length < MIN_NEW_PASSWORD : fields.password.length < 1) {
    errors.password = mode === 'up' ? `Use at least ${MIN_NEW_PASSWORD} characters.` : 'Enter your password.';
  }
  return errors;
}

/** Runs a contract schema and reports the first problem per field, so the form and the server share one set of rules. */
function validateWith<F extends string>(schema: ZodType<unknown>, value: unknown): FieldErrors<F> {
  const result = schema.safeParse(value);
  const errors: FieldErrors<F> = {};
  if (!result.success) for (const issue of result.error.issues) { const field = String(issue.path[0]) as F; errors[field] ??= issue.message; }
  return errors;
}

export const validateNewCamp = (fields: { name: string; slug: string }) => validateWith<'name' | 'slug'>(NewOrgInputSchema, fields);
export const validateCampName = (name: string): string | undefined => validateWith<'name'>(OrgPatchInputSchema, { name }).name;
