import type { SessionPriceInput } from '@buxa/contracts';
import type { AuditData } from '../audit/types';

/**
 * The audit entry for a session price change. Audit data is flat, so the old and the new price are written as `previous*` and
 * plain fields, with amounts in minor units. A null price (none set) is written as nulls.
 */
export function priceChangeAudit(before: SessionPriceInput | null, after: SessionPriceInput | null): AuditData {
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
export function samePrice(a: SessionPriceInput | null, b: SessionPriceInput | null): boolean {
  return (
    (a === null) === (b === null) &&
    a?.currency === b?.currency &&
    a?.regularMinor === b?.regularMinor &&
    (a?.earlyBirdMinor ?? null) === (b?.earlyBirdMinor ?? null) &&
    (a?.earlyBirdUntil ?? null) === (b?.earlyBirdUntil ?? null)
  );
}
