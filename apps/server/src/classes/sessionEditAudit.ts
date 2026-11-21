import type { AuditData } from '../audit/types';

/** A session's editable details, as stored: the price is not one of them. Dates are YYYY-MM-DD, or null before a class has one. */
export interface SessionDetails {
  name: string;
  description: string;
  startsOn: string | null;
  endsOn: string | null;
  isPublic: boolean;
}

/** True when no detail differs, so an unchanged save writes no audit entry. */
export function sameSessionDetails(a: SessionDetails, b: SessionDetails): boolean {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.startsOn === b.startsOn &&
    a.endsOn === b.endsOn &&
    a.isPublic === b.isPublic
  );
}

/**
 * The audit entry for a session edit. Audit data is flat, so the old and the new values are written side by side as `previous*`
 * and plain fields (the same shape as the price entry in priceAudit.ts).
 */
export function sessionEditAudit(before: SessionDetails, after: SessionDetails): AuditData {
  return {
    previousName: before.name,
    name: after.name,
    previousDescription: before.description,
    description: after.description,
    previousStartsOn: before.startsOn,
    startsOn: after.startsOn,
    previousEndsOn: before.endsOn,
    endsOn: after.endsOn,
    previousIsPublic: before.isPublic,
    isPublic: after.isPublic,
  };
}
