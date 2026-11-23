/**
 * What the badge panel shows, as one value. `closed` shows no code. `shown` holds the QR payload for as long as the badge view is on
 * screen, and only after Show, Reissue or Issue. `notice` is an inline error message. Issuing, reissuing or revoking closes any view,
 * so a code never stays on screen past the action that replaced it. Success is a toast, not text in the panel.
 */
export type BadgeView = { kind: 'closed' } | { kind: 'shown'; payload: string } | { kind: 'notice'; message: string };

export interface BadgePanelState {
  /** Whether the person holds an active badge, as far as this panel knows it. */
  active: boolean;
  view: BadgeView;
}

export type BadgePanelEvent =
  /** A badge was issued or reissued. Any open view closes; the caller then shows the new badge. */
  | { type: 'issued' }
  /** Show (or the view after an issue) returned the stored code. */
  | { type: 'revealed'; payload: string }
  /** Revoke succeeded: no badge is active and no view remains. */
  | { type: 'revoked' }
  /** The badge view was closed by hand. */
  | { type: 'closed' }
  /** An action failed or cannot show the code; the message says why. */
  | { type: 'notice'; message: string }
  /** The page reports whether a badge is active (for example after a refresh by someone else). */
  | { type: 'synced'; active: boolean };

export const initialBadgePanelState = (active: boolean): BadgePanelState => ({ active, view: { kind: 'closed' } });

export function badgePanelReducer(state: BadgePanelState, event: BadgePanelEvent): BadgePanelState {
  switch (event.type) {
    case 'issued':
      return { active: true, view: { kind: 'closed' } };
    case 'revealed':
      return { active: state.active, view: { kind: 'shown', payload: event.payload } };
    case 'revoked':
      return { active: false, view: { kind: 'closed' } };
    case 'closed':
      return { active: state.active, view: { kind: 'closed' } };
    case 'notice':
      return { active: state.active, view: { kind: 'notice', message: event.message } };
    case 'synced':
      return event.active === state.active ? state : { active: event.active, view: { kind: 'closed' } };
  }
}
