'use client';

import { useEffect, useState } from 'react';
import { DatePicker, TextField } from '@/components/atoms';
import { Segmented } from '@/components/elements';
import {
  DEFAULT_CURRENCY,
  earlyBirdFromDiscount,
  formatMoney,
  minorToInput,
  parseMoney,
  type DiscountKind,
  type EarlyBirdResult,
  type ClassPrice,
} from '@buxa/domain';

/*
 * The price block of a class: the regular price and its currency (one row, two equal columns), then the discount (a percentage
 * or an amount off, and the value, one row) and the day it ends. The contract stores only the early-bird price and its last day,
 * so the discount is worked out here: earlyBirdFromDiscount turns it into the early-bird amount, which goes in a hidden field
 * named earlyBirdAmount. Blank means no price. Nothing here is charged; the hint says so.
 */

const DISCOUNT_OPTIONS: { value: DiscountKind; label: string }[] = [
  { value: 'percent', label: 'Percentage' },
  { value: 'amount', label: 'Amount' },
];

const REASON_MESSAGE: Record<'format' | 'precision' | 'range' | 'not-positive', string> = {
  format: 'Type a percentage like 10, or an amount like 5.00.',
  precision: 'This currency has fewer decimal places. Remove the extra digits.',
  range: 'That amount is too large.',
  'not-positive': 'The discount must leave a price above zero.',
};

/** A saved early-bird price shows as the amount off it, so the form starts with the same discount. */
function startingDiscount(price: ClassPrice | null | undefined): { kind: DiscountKind; value: string } {
  if (!price || price.earlyBirdMinor === null) {
    return { kind: 'percent', value: '' };
  }

  return { kind: 'amount', value: minorToInput(price.regularMinor - price.earlyBirdMinor, price.currency) };
}

export function PriceFields({
  price,
  error,
  onDiscountProblem,
}: {
  price?: ClassPrice | null;
  error: (name: string) => string | undefined;
  /** Tells the form whether the discount leaves no price, so it can refuse to submit. */
  onDiscountProblem?: (problem: boolean) => void;
}) {
  const [amount, setAmount] = useState(price ? minorToInput(price.regularMinor, price.currency) : '');
  const [currency, setCurrency] = useState(price?.currency ?? DEFAULT_CURRENCY);
  const [discount, setDiscount] = useState(() => startingDiscount(price));

  const code = currency.trim().toUpperCase() || DEFAULT_CURRENCY;
  const regular = amount.trim() === '' ? null : parseMoney(amount, code);
  const regularMinor = regular?.ok ? regular.minor : null;
  const early: EarlyBirdResult | null =
    discount.value.trim() === '' || regularMinor === null ? null : earlyBirdFromDiscount(regularMinor, code, discount);
  const earlyMinor = early?.ok ? early.minor : null;
  const discountProblem = early !== null && !early.ok;
  const discountMessage = early && !early.ok ? REASON_MESSAGE[early.reason] : undefined;

  useEffect(() => {
    onDiscountProblem?.(discountProblem);
  }, [discountProblem, onDiscountProblem]);

  return (
    <div className="price-block">
      <hr className="price-rule" />
      <div className="price-head">
        <h3 className="price-title">Price</h3>
        <p className="class-helper">For information only. Nothing is charged.</p>
      </div>
      <div className="buxa:grid buxa:grid-cols-2 buxa:gap-[var(--s3)] buxa:items-start">
        <TextField
          label="Price"
          name="priceAmount"
          autoComplete="off"
          value={amount}
          onChange={setAmount}
          error={error('priceAmount')}
          placeholder="45.00"
        />
        <TextField
          label="Currency"
          name="priceCurrency"
          maxLength={3}
          autoComplete="off"
          value={currency}
          onChange={setCurrency}
          error={error('priceCurrency')}
        />
      </div>
      {/* The discount row: three equal columns (the type, the value, the day it ends), stacked on a phone (see classes.css). */}
      <div className="price-discount-row">
        <div className="price-discount-kind">
          <span className="field-label">Discount</span>
          <Segmented
            className="price-discount"
            label="Discount type"
            value={discount.kind}
            onChange={kind => setDiscount({ ...discount, kind })}
            options={DISCOUNT_OPTIONS}
          />
        </div>
        <TextField
          label="Discount value"
          name="discountValue"
          autoComplete="off"
          value={discount.value}
          onChange={value => setDiscount({ ...discount, value })}
          placeholder={discount.kind === 'percent' ? '10' : '5.00'}
          error={discountMessage ?? error('earlyBirdAmount')}
          hint={earlyMinor === null ? undefined : `Early-bird price: ${formatMoney(earlyMinor, code)}`}
        />
        <DatePicker
          label="Discount applies until"
          name="earlyBirdUntil"
          defaultValue={price?.earlyBirdUntil ?? null}
          error={error('earlyBirdUntil')}
          hint="The discounted price applies on this day, in the camp's time zone."
        />
      </div>
      <input type="hidden" name="earlyBirdAmount" value={earlyMinor === null ? '' : minorToInput(earlyMinor, code)} />
    </div>
  );
}
