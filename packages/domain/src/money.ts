/**
 * Money as integers in the smallest currency unit (cents for USD, yen for JPY). Every step here is integer or string work:
 * no floating point, so a price never picks up a rounding error on the way in or out. Amounts are never rounded silently:
 * input with more decimal places than the currency has is refused.
 */

/** Decimal places per ISO 4217 currency. Codes not listed use 2, the most common exponent. */
const EXPONENTS: Readonly<Record<string, number>> = {
  BHD: 3,
  JOD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  VND: 0,
  XAF: 0,
  XOF: 0,
};

/** The largest amount a price can hold, in minor units (999,999,999.99 at two places). Matches the database check. */
export const MAX_MINOR_AMOUNT = 99_999_999_999;

export const DEFAULT_CURRENCY = 'USD';

export const isCurrencyCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Z]{3}$/.test(value);

export function currencyExponent(currency: string): number {
  return EXPONENTS[currency] ?? 2;
}

/** A display string for an amount in minor units, for example "$1,234.50" or "¥1,235". Integer arithmetic only. */
export function formatMoney(minor: number, currency: string, locale = 'en-US'): string {
  if (!Number.isSafeInteger(minor)) {
    throw new RangeError('An amount is a whole number of minor units.');
  }
  const exponent = currencyExponent(currency);
  const negative = minor < 0;
  const digits = String(Math.abs(minor)).padStart(exponent + 1, '0');
  const whole = BigInt(digits.slice(0, digits.length - exponent));
  const fraction = digits.slice(digits.length - exponent);
  const grouped = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(whole);
  const symbol =
    new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find(part => part.type === 'currency')?.value ?? currency;
  const body = exponent > 0 ? `${grouped}.${fraction}` : grouped;

  return `${negative ? '-' : ''}${symbol}${body}`;
}

/** The amount as an editable number with no grouping, for example "1234.50", so a form starts with the saved value. */
export function minorToInput(minor: number, currency: string): string {
  const exponent = currencyExponent(currency);
  const digits = String(minor).padStart(exponent + 1, '0');

  return exponent > 0
    ? `${digits.slice(0, digits.length - exponent)}.${digits.slice(digits.length - exponent)}`
    : digits;
}

export type MoneyParse = { ok: true; minor: number } | { ok: false; reason: 'format' | 'precision' | 'range' };

/**
 * Reads what a person typed ("45", "45.5", "1,234.50") as minor units. Commas and spaces are ignored. Trailing zeros beyond the
 * currency's places are allowed ("45.000" for yen is fine); any other extra digit is refused, never rounded.
 */
export function parseMoney(input: string, currency: string): MoneyParse {
  const text = input.replace(/[\s,]/g, '');
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) {
    return { ok: false, reason: 'format' };
  }
  const exponent = currencyExponent(currency);
  const whole = match[1];
  const fraction = match[2] ?? '';
  if (fraction.slice(exponent).replace(/0/g, '') !== '') {
    return { ok: false, reason: 'precision' };
  }
  const places = fraction.slice(0, exponent).padEnd(exponent, '0');
  const minor = Number(`${whole}${places}`);
  if (!Number.isSafeInteger(minor) || minor > MAX_MINOR_AMOUNT) {
    return { ok: false, reason: 'range' };
  }

  return { ok: true, minor };
}
