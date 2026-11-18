import type { PersonMembership } from '@buxa/contracts';
import { formatCampDateTime } from '@buxa/shared';
import { AccessPill } from './AccessPill';
import { RevokeMembershipForm } from '@/components/components/people/forms/export';
import { formatLocalDate } from '@buxa/shared';
import type { ClockFormat } from '@buxa/domain';
import { buttonClassName } from '@/components/elements/export';

interface MembershipRowProps { membership: PersonMembership; personId: string; canManage: boolean; timeZone: string; clockFormat: ClockFormat }

/**
 * One membership: its plan, its dates and its status in words. Dates are camp days; the revoke time is an instant shown in the camp's
 * zone (`timeZone`), like every other time on the people screens. Revoking is behind a disclosure, and asks for a reason.
 */
export function MembershipRow({ membership, personId, canManage, timeZone, clockFormat }: MembershipRowProps) {
  const revoked = membership.status === 'revoked';

  return (
    <li className="people-member">
      <div className="people-member-main">
        <strong>{membership.plan}</strong>
        <span className="muted">{formatLocalDate(membership.startsOn)} to {formatLocalDate(membership.endsOn)}</span>
        {revoked && membership.revokedAt && (
          <span className="muted">Revoked {formatCampDateTime(membership.revokedAt, timeZone, clockFormat)}{membership.revokedReason ? `: ${membership.revokedReason}` : ''}</span>
        )}
      </div>
      <div className="row">
        <AccessPill status={membership.status} />
        {canManage && !revoked && (
          <details className="people-disclosure">
            <summary className={buttonClassName({ variant: 'danger-ghost', size: 'sm' })}>Revoke</summary>
            <RevokeMembershipForm membershipId={membership.id} personId={personId} />
          </details>
        )}
      </div>
    </li>
  );
}
