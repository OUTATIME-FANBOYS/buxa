/**
 * Returns the value, or throws when it is missing. Use where the surrounding code
 * has already established that a value exists but the type system cannot see it.
 */
export function requirePresent<T>(value: T | null | undefined, label: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Expected ${label} to be present`);
  }
  return value;
}
