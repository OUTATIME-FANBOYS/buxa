import type { ZodType } from 'zod';
import { failure, type ActionState, type FieldErrors } from '@/lib/actions/state';

/** One text value from a posted form. Anything that is not a string (missing, a file) counts as empty, so the schema reports it. */
export const text = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
};

export type Parsed<T> = { ok: true; data: T } | { ok: false; state: ActionState };

/**
 * Runs a `@buxa/contracts` schema over posted values. The schema is the only source of validation rules and messages:
 * each field gets the first message the schema gives for it.
 */
export function parseInput<T>(schema: ZodType<T>, values: Record<string, string>): Parsed<T> {
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, data: result.data };
  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? '');
    if (field) fieldErrors[field] ??= issue.message;
  }
  return { ok: false, state: failure('Check the highlighted fields.', fieldErrors) };
}
