import { DatePicker, TextField } from '@/components/atoms';
import { DEFAULT_CURRENCY, minorToInput, type SessionPrice } from '@buxa/domain';

/**
 * The price fields shared by the New session form and the Price dialog. Two rows: the price and its currency, then the early-bird
 * price and the day it ends. Blank means no price. Nothing here is charged; the hint says so.
 */
export function PriceFields({
  price,
  error,
}: {
  price?: SessionPrice | null;
  error: (name: string) => string | undefined;
}) {
  const currency = price?.currency ?? DEFAULT_CURRENCY;

  return (
    <fieldset className="price-fields">
      <legend className="class-helper">Price, for information only. Nothing is charged.</legend>
      <div className="form-row buxa:flex buxa:flex-wrap buxa:gap-[var(--s3)] buxa:items-start buxa:[&>.field]:flex-[1_1_160px] buxa:[&>.field]:min-w-0">
        <TextField
          label="Price"
          name="priceAmount"
          autoComplete="off"
          defaultValue={price ? minorToInput(price.regularMinor, currency) : ''}
          error={error('priceAmount')}
          placeholder="45.00"
        />
        <TextField
          label="Currency"
          name="priceCurrency"
          maxLength={3}
          autoComplete="off"
          defaultValue={currency}
          error={error('priceCurrency')}
        />
      </div>
      <div className="form-row buxa:flex buxa:flex-wrap buxa:gap-[var(--s3)] buxa:items-start buxa:[&>.field]:flex-[1_1_160px] buxa:[&>.field]:min-w-0">
        <TextField
          label="Early-bird price"
          name="earlyBirdAmount"
          autoComplete="off"
          defaultValue={price?.earlyBirdMinor != null ? minorToInput(price.earlyBirdMinor, currency) : ''}
          error={error('earlyBirdAmount')}
        />
        <DatePicker
          label="Early-bird until"
          name="earlyBirdUntil"
          defaultValue={price?.earlyBirdUntil ?? null}
          error={error('earlyBirdUntil')}
          hint="The early-bird price applies on this day, in the camp's time zone."
        />
      </div>
    </fieldset>
  );
}
