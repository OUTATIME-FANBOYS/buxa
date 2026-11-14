import type { PersonMembership } from '@buxa/contracts';
import { AccessPill } from './AccessPill';
import { RevokeMembershipForm } from '../forms/RevokeMembershipForm';
import { formatInstant, formatLocalDate } from '../lib/format';

/** One membership: its plan, its dates and its status in words. Revoking is behind a disclosure, and asks for a reason. */
export function MembershipRow({ membership, personId, canManage }: { membership: PersonMembership; personId: string; canManage: boolean }) {
  const revoked = membership.status === 'revoked';
  return (
    <li className="people-member">
      <div className="people-member-main">
        <strong>{membership.plan}</strong>
        <span className="muted">{formatLocalDate(membership.startsOn)} to {formatLocalDate(membership.endsOn)}</span>
        {revoked && membership.revokedAt && (
          <span className="muted">Revoked {formatInstant(membership.revokedAt)}{membership.revokedReason ? `: ${membership.revokedReason}` : ''}</span>
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
