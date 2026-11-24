import { toLocalDate, type LocalDate } from './people/localDate';

/**
 * A class's price, as stored (each class carries its own). Shown for information only in this phase: nothing is charged.
 * The early-bird amount applies on and before its end date, read as a calendar day in the camp's time zone.
 */
export interface ClassPrice {
  currency: string;
  regularMinor: number;
  earlyBirdMinor: number | null;
  earlyBirdUntil: LocalDate | null;
}

/** The amount a screen shows today, and whether it is the early-bird amount. */
export interface ShownPrice {
  currency: string;
  amountMinor: number;
  earlyBird: boolean;
}

/** The camp's calendar day at `instant`, in the camp's zone. The same day rule the rest of the app uses. */
export const campToday = (instant: Date, timeZone: string): LocalDate => toLocalDate(instant, timeZone);

/**
 * The early-bird switch. The early-bird amount is shown while today is on or before its end date, and the regular amount after
 * that. A session with no early-bird amount, or no end date, always shows the regular amount.
 */
export function shownPrice(price: ClassPrice | null, today: LocalDate): ShownPrice | null {
  if (!price) {
    return null;
  }
  if (price.earlyBirdMinor !== null && price.earlyBirdUntil !== null && today <= price.earlyBirdUntil) {
    return { currency: price.currency, amountMinor: price.earlyBirdMinor, earlyBird: true };
  }

  return { currency: price.currency, amountMinor: price.regularMinor, earlyBird: false };
}
