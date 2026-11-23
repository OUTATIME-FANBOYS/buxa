'use client';

import { useId, useState } from 'react';
import type { PersonMembership } from '@buxa/contracts';
import { formatCampDateTime } from '@buxa/shared';
import { AccessPill } from './AccessPill';
import { RevokeMembershipForm } from '@/components/components/people/forms';
import { formatLocalDate } from '@buxa/shared';
import type { ClockFormat } from '@buxa/domain';
import { buttonClassName } from '@/components/atoms/Button';

interface MembershipRowProps {
  membership: PersonMembership;
  personId: string;
  canManage: boolean;
  timeZone: string;
  clockFormat: ClockFormat;
}

/**
 * One membership: its name (the session's, or a custom name), its dates and its status in words. Dates are camp days; the revoke time is an instant shown in the camp's
 * zone (`timeZone`), like every other time on the people screens. Revoking is behind a disclosure, and asks for a reason.
 */
export function MembershipRow({ membership, personId, canManage, timeZone, clockFormat }: MembershipRowProps) {
  const [revoking, setRevoking] = useState(false);
  const formId = useId();
  const revoked = membership.status === 'revoked';
  const revocable = canManage && !revoked;

  return (
    <li className="people-member">
      <div className="people-member-row">
        <div className="people-member-main">
          <strong>{membership.plan}</strong>
          <span className="muted">
            {formatLocalDate(membership.startsOn)} to {formatLocalDate(membership.endsOn)}
          </span>
          {revoked && membership.revokedAt && (
            <span className="muted">
              Revoked {formatCampDateTime(membership.revokedAt, timeZone, clockFormat)}
              {membership.revokedReason ? `: ${membership.revokedReason}` : ''}
            </span>
          )}
        </div>
        {/* The pill and the Revoke button are direct children of the row, so the three share one centre line and one gap. */}
        <AccessPill status={membership.status} />
        {revocable && (
          <button
            type="button"
            className={buttonClassName({ variant: 'danger-soft' })}
            aria-expanded={revoking}
            aria-controls={formId}
            onClick={() => setRevoking(open => !open)}
          >
            {revoking ? 'Cancel' : 'Revoke'}
          </button>
        )}
      </div>
      {revocable && revoking && (
        <div id={formId} className="people-member-revoke">
          <RevokeMembershipForm membershipId={membership.id} personId={personId} />
        </div>
      )}
    </li>
  );
}
