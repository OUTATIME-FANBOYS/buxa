'use client';

import { useEffect, useReducer, useTransition } from 'react';
import { BadgeView } from '@/components/components/badge';
import { BadgeActions } from '@/components/components/people/forms';
import { Pill } from '@/components/elements';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { issueBadgeAction, revokeBadgeAction, showBadgeAction } from '@/actions/people';
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

/** Maps what Show returned onto the panel's event. The code is only ever in the `shown` case. */
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
 * The badge (QR code) for the door. The header says in words whether a badge is active. The code leaves the server only when Show,
 * Issue or Reissue opens the badge view, and it is held in this panel's state until Close, Reissue, Revoke or a refresh replaces it.
 * Success is a toast; failures are a short inline message. Nothing about the code is in the page's props.
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
  const { toast } = useUi();

  // The page's own answer wins when it changes (for example after a refresh); the local state follows the actions in between.
  useEffect(() => {
    dispatch({ type: 'synced', active: hasActiveBadge });
  }, [hasActiveBadge]);

  const show = () =>
    startTransition(async () => {
      dispatch(revealEvent(await showBadgeAction(personId)));
    });

  // Issue and reissue: the badge is issued, then the new card opens straight away. The toast says which it was.
  const issue = () => {
    const replaced = state.active;

    startTransition(async () => {
      const result = await issueBadgeAction(idle, personForm(personId));
      if (result.status === 'success') {
        dispatch({ type: 'issued' });
        toast(replaced ? 'Badge reissued.' : 'Badge issued.');
        dispatch(revealEvent(await showBadgeAction(personId)));
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
        toast('Badge revoked.');
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
          <BadgeActions active={state.active} busy={busy} onShow={show} onIssue={issue} onRevoke={revoke} />
          {view.kind === 'shown' && (
            <BadgeView
              personName={personName}
              roleLabel={roleLabel}
              campName={campName}
              payload={view.payload}
              onClose={() => dispatch({ type: 'closed' })}
            />
          )}
        </div>
      )}
    </section>
  );
}
