'use client';

import { useState, useTransition } from 'react';
import { BadgeCard } from './BadgeCard';
import { Button, PrintButton } from '@/components/elements';
import { reprintBadgeAction, showBadgeAction } from '@/actions/people';
import type { ShowBadgeState } from '@buxa/shared';

interface BadgeRevealProps {
  personId: string;
  personName: string;
  roleLabel: string;
  campName: string;
  /** Admins and owners see Reprint as well: the same code again, for a damaged card. */
  canReprint?: boolean;
}

/**
 * Shows an active badge on demand. The code comes from the server only when Show or Reprint is pressed, and it is held in this
 * component's state until Close. Nothing is kept in the page: leaving or refreshing the page drops it.
 */
export function BadgeReveal({ personId, personName, roleLabel, campName, canReprint = false }: BadgeRevealProps) {
  const [result, setResult] = useState<ShowBadgeState | null>(null);
  const [pending, startTransition] = useTransition();

  const load = (action: (id: string) => Promise<ShowBadgeState>) => {
    startTransition(async () => {
      setResult(await action(personId));
    });
  };

  if (result === null) {
    return (
      <div className="row">
        <Button variant="secondary" icon="badge" disabled={pending} onClick={() => load(showBadgeAction)}>
          {pending ? 'Loading…' : 'Show badge'}
        </Button>
        {canReprint && (
          <Button variant="ghost" disabled={pending} onClick={() => load(reprintBadgeAction)}>
            Reprint badge
          </Button>
        )}
      </div>
    );
  }

  const close = (
    <Button variant="glass" onClick={() => setResult(null)}>
      Close
    </Button>
  );

  if (result.status === 'failed') {
    return (
      <div className="stack">
        <p role="alert" className="people-message">
          {result.message}
        </p>
        <div className="row">{close}</div>
      </div>
    );
  }

  if (result.status === 'reissue') {
    return (
      <div className="stack">
        <p role="status" className="people-message">
          Reissue to show the badge.
        </p>
        <div className="row">{close}</div>
      </div>
    );
  }

  return (
    <div className="stack people-badge">
      <BadgeCard personName={personName} roleLabel={roleLabel} campName={campName} payload={result.payload} />
      <div className="row">
        <PrintButton />
        {close}
      </div>
    </div>
  );
}
