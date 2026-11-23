/**
 * How long a seat hold reserves a place while the family completes registration, when the camp has not set its own length.
 * The default lives here and nowhere else; a camp's own setting is `orgs.hold_minutes` (migration 0047), null for the default.
 */
export const SEAT_HOLD_MINUTES = 15;

/** The shortest and longest length a camp may set, in whole minutes. The database checks the same range (migration 0047). */
export const HOLD_MINUTES_MIN = 5;
export const HOLD_MINUTES_MAX = 60;

/** True for a whole number of minutes from 5 to 60. */
export function isValidHoldMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= HOLD_MINUTES_MIN && value <= HOLD_MINUTES_MAX;
}

/** The length a hold lasts for a camp: the camp's own setting, or SEAT_HOLD_MINUTES when it has none (null). */
export function holdLengthMinutes(setting: number | null): number {
  return setting ?? SEAT_HOLD_MINUTES;
}

/** The time a hold taken at `now` expires, for a hold of `minutes` (the default length when none is given). */
export function holdExpiresAt(now: Date, minutes: number = SEAT_HOLD_MINUTES): Date {
  return new Date(now.getTime() + minutes * 60_000);
}

/** A hold holds a place only while it is unreleased and its time has not passed. An expired hold returns its place at once. */
export function isHoldActive(hold: { releasedAt: Date | null; expiresAt: Date }, now: Date): boolean {
  return hold.releasedAt === null && hold.expiresAt.getTime() > now.getTime();
}
