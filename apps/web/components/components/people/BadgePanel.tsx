'use client';

import { useEffect, useReducer, useTransition } from 'react';
import { BadgeCard } from '@/components/components/badge';
import { BadgeActions } from '@/components/components/people/forms';
import { Button, PrintButton, Pill } from '@/components/elements';
import { issueBadgeAction, reprintBadgeAction, revokeBadgeAction, showBadgeAction } from '@/actions/people';
import {
  badgePanelReducer,
  idle,
  initialBadgePanelState,
  type BadgePanelEvent,
  type ShowBadgeState,
} from '@buxa/shared';

export interface BadgePanelProps {
  personId: string;
  personName: string;
  roleLabel: string;
  campName: string;
  hasActiveBadge: boolean;
  archived: boolean;
  canManage: boolean;
}

/** Maps what Show or Reprint returned onto the panel's event. The code is only ever in the `shown` case. */
function revealEvent(result: ShowBadgeState): BadgePanelEvent {
  if (result.status === 'shown') {
    return { type: 'revealed', payload: result.payload };
  }
  if (result.status === 'reissue') {
    return { type: 'notice', message: 'Reissue to show the badge.' };
  }

  return { type: 'notice', message: result.message };
}

/** The form the server actions read: the person's id, nothing else. */
function personForm(personId: string): FormData {
  const form = new FormData();
  form.set('personId', personId);

  return form;
}

/**
 * The badge (QR code) for the door. The header says in words whether a badge is active. The code leaves the server only when Show
 * or Reprint is pressed, and it is held in this panel's state until Close, Issue, Reissue or Revoke replaces it. Issue and Reissue
 * never send the code: the new badge is viewed with Show badge like any other. Nothing about the code is in the page's props.
 */
export function BadgePanel({
  personId,
  personName,
  roleLabel,
  campName,
  hasActiveBadge,
  archived,
  canManage,
}: BadgePanelProps) {
  const [state, dispatch] = useReducer(badgePanelReducer, hasActiveBadge, initialBadgePanelState);
  const [busy, startTransition] = useTransition();

  // The page's own answer wins when it changes (for example after a refresh); the local state follows the actions in between.
  useEffect(() => {
    dispatch({ type: 'synced', active: hasActiveBadge });
  }, [hasActiveBadge]);

  const reveal = (action: (id: string) => Promise<ShowBadgeState>) =>
    startTransition(async () => {
      dispatch(revealEvent(await action(personId)));
    });

  const issue = () => {
    const replaced = state.active;

    startTransition(async () => {
      const result = await issueBadgeAction(idle, personForm(personId));
      if (result.status === 'success') {
        dispatch({ type: 'issued', replaced });
      } else if (result.status === 'error') {
        dispatch({ type: 'notice', message: result.message });
      }
    });
  };

  const revoke = () =>
    startTransition(async () => {
      const result = await revokeBadgeAction(idle, personForm(personId));
      if (result.status === 'success') {
        dispatch({ type: 'revoked' });
      } else if (result.status === 'error') {
        dispatch({ type: 'notice', message: result.message });
      }
    });

  const view = state.view;

  return (
    <section className="panel" aria-labelledby="badge-heading">
      <div className="panel-head">
        <h2 id="badge-heading" className="people-heading">
          Badge
        </h2>
        {state.active ? <Pill tone="ok">Badge active</Pill> : <Pill tone="neutral">No active badge</Pill>}
      </div>
      {archived ? (
        <p className="muted">Archived people cannot have a badge.</p>
      ) : !canManage ? (
        <p className="muted">Only admins can issue or revoke badges.</p>
      ) : (
        <div className="stack">
          {view.kind === 'closed' && !state.active && <p className="muted">No badge yet.</p>}
          {view.kind === 'closed' && state.active && (
            <p className="muted">Reissuing replaces the current badge. The old code stops working at once.</p>
          )}
          {view.kind === 'notice' && (
            <p role="alert" className="people-message">
              {view.message}
            </p>
          )}
          {view.kind === 'done' && (
            <p role="status" className="people-message people-message-ok">
              {view.message}
            </p>
          )}
          <BadgeActions
            active={state.active}
            busy={busy}
            onShow={() => reveal(showBadgeAction)}
            onReprint={() => reveal(reprintBadgeAction)}
            onIssue={issue}
            onRevoke={revoke}
          />
          {view.kind === 'shown' && (
            <div className="stack people-badge">
              <BadgeCard personName={personName} roleLabel={roleLabel} campName={campName} payload={view.payload} />
              <div className="row">
                <PrintButton />
                <Button variant="ghost" onClick={() => dispatch({ type: 'closed' })}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
