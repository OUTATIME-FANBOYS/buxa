const UNIQUE_VIOLATION = '23505';

/** True when Postgres rejected a write because a unique constraint would be broken. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === UNIQUE_VIOLATION;
}

export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));
