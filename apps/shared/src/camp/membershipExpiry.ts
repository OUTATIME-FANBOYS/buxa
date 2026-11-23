/** Team access ending within this many days shows its date in the team list. */
export const EXPIRY_SOON_DAYS = 14;

export type ExpiryState = 'none' | 'expired' | 'soon' | 'later';

/**
 * Where a membership's expiry stands on `now`. A null (or missing) expiry is never ending. expiresAt is stored at midnight UTC of the
 * chosen day, so the day is its first ten characters.
 */
export function expiryState(expiresAt: string | null | undefined, now: Date): ExpiryState {
  if (!expiresAt) {
    return 'none';
  }
  const at = new Date(expiresAt).getTime();
  if (at <= now.getTime()) {
    return 'expired';
  }

  return at - now.getTime() <= EXPIRY_SOON_DAYS * 86400000 ? 'soon' : 'later';
}

/** The day an expiry falls on, as YYYY-MM-DD. */
export const expiryDay = (expiresAt: string): string => expiresAt.slice(0, 10);
