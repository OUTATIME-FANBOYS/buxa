'use client';

import { useActionState } from 'react';
import { BadgeCard } from '@/components/components/badge/export';
import { PrintButton, Button } from '@/components/elements/export';
import { idle } from '@buxa/shared';
import { issueBadgeAction, revokeBadgeAction } from '@/actions/people';
import type { BadgeState } from '@buxa/shared';
import { FormMessage } from './FormMessage';

interface BadgeActionsProps {
  personId: string;
  hasActiveBadge: boolean;
  personName: string;
  roleLabel: string;
  campName: string;
}

const initial: BadgeState = idle;

/**
 * Issue, reissue (which replaces the old badge) and revoke. A new badge is shown here once, with a print button. Nothing keeps it:
 * leaving the page or refreshing it is the end of the only display of the code.
 */
export function BadgeActions({ personId, hasActiveBadge, personName, roleLabel, campName }: BadgeActionsProps) {
  const [issued, issueAction, issuing] = useActionState(issueBadgeAction, initial);
  const [revoked, revokeAction, revoking] = useActionState(revokeBadgeAction, idle);
  const newBadge = issued.status === 'issued' ? issued.payload : null;

  return (
    <div className="stack">
      <div className="row">
        <form action={issueAction}>
          <input type="hidden" name="personId" value={personId} />
          <Button variant="primary" disabled={issuing}>{issuing ? 'Making badge…' : hasActiveBadge ? 'Reissue badge' : 'Issue badge'}</Button>
        </form>
        {hasActiveBadge && (
          <form action={revokeAction}>
            <input type="hidden" name="personId" value={personId} />
            <Button variant="danger-soft" disabled={revoking}>{revoking ? 'Revoking…' : 'Revoke badge'}</Button>
          </form>
        )}
      </div>
      {hasActiveBadge && !newBadge && <p className="muted">Reissuing replaces the current badge. The old code stops working at once.</p>}
      <FormMessage state={issued.status === 'issued' ? idle : issued} />
      <FormMessage state={revoked} />
      {newBadge && (
        <div className="stack people-badge">
          <p role="status" className="people-message people-message-ok">New badge. It is shown once: print it now.</p>
          <BadgeCard personName={personName} roleLabel={roleLabel} campName={campName} payload={newBadge} />
          <div><PrintButton /></div>
        </div>
      )}
    </div>
  );
}
