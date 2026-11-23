'use client';

import { useState, useTransition } from 'react';
import { BadgeView } from './BadgeView';
import { Button } from '@/components/elements';
import { showBadgeAction } from '@/actions/people';
import type { ShowBadgeState } from '@buxa/shared';

interface BadgeRevealProps {
  personId: string;
  personName: string;
  roleLabel: string;
  campName: string;
}

/**
 * Shows an active badge on demand. The code comes from the server only when Show is pressed, and it is held in this component's
 * state until Close. Nothing is kept in the page: leaving or refreshing the page drops it.
 */
export function BadgeReveal({ personId, personName, roleLabel, campName }: BadgeRevealProps) {
  const [result, setResult] = useState<ShowBadgeState | null>(null);
  const [pending, startTransition] = useTransition();

  const show = () => {
    startTransition(async () => {
      setResult(await showBadgeAction(personId));
    });
  };

  if (result === null) {
    return (
      <div className="row">
        <Button variant="secondary" icon="badge" disabled={pending} onClick={show}>
          {pending ? 'Loading…' : 'Show badge'}
        </Button>
      </div>
    );
  }

  const close = () => setResult(null);

  if (result.status === 'failed') {
    return (
      <div className="stack">
        <p role="alert" className="people-message">
          {result.message}
        </p>
        <div className="row">
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  if (result.status === 'reissue') {
    return (
      <div className="stack">
        <p role="status" className="people-message">
          Reissue to show the badge.
        </p>
        <div className="row">
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <BadgeView
      personName={personName}
      roleLabel={roleLabel}
      campName={campName}
      payload={result.payload}
      onClose={close}
    />
  );
}
