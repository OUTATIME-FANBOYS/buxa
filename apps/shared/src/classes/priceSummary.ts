import { campToday, formatMoney, shownPrice, type ClassPrice } from '@buxa/domain';

/**
 * The words for a class's price today, in the camp's time zone. While the early-bird day has not passed, the early-bird amount
 * comes first and the regular price follows it; after that day, only the regular price is shown. Null when the class has no price.
 */
export function priceSummary(price: ClassPrice | null, timeZone: string, now: Date = new Date()): string {
  if (!price) {
    return 'Not set';
  }
  const regular = formatMoney(price.regularMinor, price.currency);
  const shown = shownPrice(price, campToday(now, timeZone));
  if (shown?.earlyBird && price.earlyBirdUntil) {
    return `${formatMoney(shown.amountMinor, price.currency)} early-bird until ${price.earlyBirdUntil}, then ${regular}`;
  }
  if (price.earlyBirdMinor !== null && price.earlyBirdUntil) {
    return `${regular}. The early-bird price ended ${price.earlyBirdUntil}`;
  }

  return regular;
}
