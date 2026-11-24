import type { ClassPriceInput } from '@buxa/contracts';
import type { AuditData } from '../audit/types';

/**
 * The audit entry for a class price change. Audit data is flat, so the old and the new price are written as `previous*` and
 * plain fields, with amounts in minor units. A null price (none set) is written as nulls.
 */
export function priceChangeAudit(before: ClassPriceInput | null, after: ClassPriceInput | null): AuditData {
  return {
    previousCurrency: before?.currency ?? null,
    previousRegularMinor: before?.regularMinor ?? null,
    previousEarlyBirdMinor: before?.earlyBirdMinor ?? null,
    previousEarlyBirdUntil: before?.earlyBirdUntil ?? null,
    currency: after?.currency ?? null,
    regularMinor: after?.regularMinor ?? null,
    earlyBirdMinor: after?.earlyBirdMinor ?? null,
    earlyBirdUntil: after?.earlyBirdUntil ?? null,
  };
}

/** True when two prices are the same, so an unchanged price writes no audit entry. */
export function samePrice(a: ClassPriceInput | null, b: ClassPriceInput | null): boolean {
  return (
    (a === null) === (b === null) &&
    a?.currency === b?.currency &&
    a?.regularMinor === b?.regularMinor &&
    (a?.earlyBirdMinor ?? null) === (b?.earlyBirdMinor ?? null) &&
    (a?.earlyBirdUntil ?? null) === (b?.earlyBirdUntil ?? null)
  );
}
