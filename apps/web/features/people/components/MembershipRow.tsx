import type { PersonMembership } from '@buxa/contracts';
import { formatCampDateTime } from '@/features/attendance/lib/time';
import { AccessPill } from './AccessPill';
import { RevokeMembershipForm } from '../forms/RevokeMembershipForm';
import { formatLocalDate } from '../lib/format';

export interface MembershipRowProps { membership: PersonMembership; personId: string; canManage: boolean; timeZone: string }

/**
 * One membership: its plan, its dates and its status in words. Dates are camp days; the revoke time is an instant shown in the camp's
 * zone (`timeZone`), like every other time on the people screens. Revoking is behind a disclosure, and asks for a reason.
 */
export function MembershipRow({ membership, personId, canManage, timeZone }: MembershipRowProps) {
  const revoked = membership.status === 'revoked';
  return (
    <li className="people-member">
      <div className="people-member-main">
        <strong>{membership.plan}</strong>
        <span className="muted">{formatLocalDate(membership.startsOn)} to {formatLocalDate(membership.endsOn)}</span>
        {revoked && membership.revokedAt && (
          <span className="muted">Revoked {formatCampDateTime(membership.revokedAt, timeZone)}{membership.revokedReason ? `: ${membership.revokedReason}` : ''}</span>
        )}
      </div>
      <div className="row">
        <AccessPill status={membership.status} />
        {canManage && !revoked && (
          <details className="people-disclosure">
            <summary className="btn btn-sm btn-ghost btn-danger-ghost">Revoke</summary>
            <RevokeMembershipForm membershipId={membership.id} personId={personId} />
          </details>
        )}
      </div>
    </li>
  );
}
