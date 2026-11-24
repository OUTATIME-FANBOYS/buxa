import { priceSummary } from '@buxa/shared';
import type { ClassPrice } from '@buxa/domain';

/** The price as a term and its value, for a details list. */
export function PriceFact({ price, timeZone }: { price: ClassPrice | null; timeZone: string }) {
  return (
    <>
      <dt>Price</dt>
      <dd className="price-fact">
        <span className="price-fact__value">{priceSummary(price, timeZone)}</span>
      </dd>
    </>
  );
}
