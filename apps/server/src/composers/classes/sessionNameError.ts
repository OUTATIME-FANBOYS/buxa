import type { FieldErrors } from '@buxa/shared';

/**
 * A duplicate session name is shown on the name field of the create and edit forms. Any other refusal has no field.
 * Kept out of the 'use server' files, which export only actions.
 */
export function nameFieldError(reason: string, message: string): FieldErrors<'name'> | undefined {
  return reason === 'session_name_taken' ? { name: message } : undefined;
}
