'use client';

import { Button } from '@/components/elements';

export interface BadgeActionsProps {
  /** Whether the person holds an active badge: decides which of the actions appear. */
  active: boolean;
  /** True while a badge action runs: every button in the row is disabled. */
  busy: boolean;
  onShow: () => void;
  /** Issue (no active badge) or reissue (replaces the active one). */
  onIssue: () => void;
  onRevoke: () => void;
}

/**
 * The badge actions, one row, left aligned, all at the one button size and without icons: Show badge, Reissue, Revoke when a badge is
 * active; Issue badge alone when none is. Each action has its own style: the view (secondary), the new badge (primary) and the
 * removal (danger-soft).
 */
export function BadgeActions({ active, busy, onShow, onIssue, onRevoke }: BadgeActionsProps) {
  if (!active) {
    return (
      <div className="row">
        <Button variant="primary" disabled={busy} onClick={onIssue}>
          Issue badge
        </Button>
      </div>
    );
  }

  return (
    <div className="row">
      <Button variant="secondary" disabled={busy} onClick={onShow}>
        Show badge
      </Button>
      <Button variant="primary" disabled={busy} onClick={onIssue}>
        Reissue
      </Button>
      <Button variant="danger-soft" disabled={busy} onClick={onRevoke}>
        Revoke
      </Button>
    </div>
  );
}
