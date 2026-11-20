import type { ReactNode } from 'react';
import { campToday, formatMoney, shownPrice, type SessionPrice } from '@buxa/domain';

/**
 * The words for a session's price today, in the camp's time zone. While the early-bird day has not passed, the early-bird amount
 * comes first and the regular price follows it; after that day, only the regular price is shown.
 */
export function priceSummary(price: SessionPrice | null, timeZone: string, now: Date = new Date()): string {
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

/** The price as a term and its value, for a details list. `action` is an optional control beside the value (staff only). */
export function PriceFact({
  price,
  timeZone,
  action,
}: {
  price: SessionPrice | null;
  timeZone: string;
  action?: ReactNode;
}) {
  return (
    <>
      <dt>Price</dt>
      <dd className="price-fact">
        <span className="price-fact__value">{priceSummary(price, timeZone)}</span>
        {action ? <span className="price-action">{action}</span> : null}
      </dd>
    </>
  );
}
