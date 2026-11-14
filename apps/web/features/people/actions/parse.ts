import type { ZodType } from 'zod';
import { failure, type ActionState, type FieldErrors } from '@/lib/actions/state';

export type Parsed<T> = { ok: true; data: T } | { ok: false; state: ActionState };

/** One posted value as a string. Anything that is not a string (missing, a file) counts as empty, so the schema reports it. */
export const field = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
};

/** Every posted value for a repeated name (checkboxes), as strings. */
export const fieldAll = (form: FormData, name: string): string[] =>
  form.getAll(name).filter((value): value is string => typeof value === 'string');

/** A checkbox: a browser posts "on" when it is ticked and posts nothing otherwise. */
export const checked = (form: FormData, name: string): boolean => form.get(name) === 'on';

/**
 * Optional fields left blank are absent, not empty strings: a blank date or id would otherwise fail its own check.
 * Required fields keep their blank value so the schema answers "Required." rather than "expected a string".
 */
export function dropBlank(values: Record<string, unknown>, optional: readonly string[]): Record<string, unknown> {
  const out = { ...values };
  for (const key of optional) if (out[key] === '') delete out[key];
  return out;
}

/**
 * Runs a `@buxa/contracts` schema over posted values. The schema is the only source of validation rules and messages;
 * each field gets the first message the schema gives for it. Errors not tied to one field appear as the form message.
 */
export function parseWith<T>(schema: ZodType<T>, values: unknown): Parsed<T> {
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, data: result.data };
  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const name = String(issue.path[0] ?? '');
    if (name) fieldErrors[name] ??= issue.message;
  }
  const message = Object.keys(fieldErrors).length > 0 ? 'Check the highlighted fields.' : (result.error.issues[0]?.message ?? 'Check the form.');
  return { ok: false, state: failure(message, fieldErrors) };
}
