/** How long a seat hold reserves a place while the family completes registration. The one place this length is set. */
export const SEAT_HOLD_MINUTES = 15;

/** The time a hold taken at `now` expires. */
export function holdExpiresAt(now: Date): Date {
  return new Date(now.getTime() + SEAT_HOLD_MINUTES * 60_000);
}

/** A hold holds a place only while it is unreleased and its time has not passed. An expired hold returns its place at once. */
export function isHoldActive(hold: { releasedAt: Date | null; expiresAt: Date }, now: Date): boolean {
  return hold.releasedAt === null && hold.expiresAt.getTime() > now.getTime();
}
