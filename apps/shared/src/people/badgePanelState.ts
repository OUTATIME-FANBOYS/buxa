/**
 * What the badge panel shows, as one value. `closed` shows no code. `shown` holds the QR payload for as long as it is on screen:
 * `fresh` is true only for a badge that was just issued or reissued, which the panel says is shown once. `notice` is a message
 * about the last action. Revoking clears any code, so a revoked badge can never stay on screen.
 */
export type BadgeView =
  { kind: 'closed' } | { kind: 'shown'; payload: string; fresh: boolean } | { kind: 'notice'; message: string };

export interface BadgePanelState {
  /** Whether the person holds an active badge, as far as this panel knows it. */
  active: boolean;
  view: BadgeView;
}

export type BadgePanelEvent =
  /** A badge was issued or reissued: it is active, and its code is shown once. */
  | { type: 'issued'; payload: string }
  /** Show or Reprint returned the stored code. */
  | { type: 'revealed'; payload: string }
  /** Revoke succeeded: no badge is active and no code remains. */
  | { type: 'revoked' }
  /** The reveal was closed by hand. */
  | { type: 'closed' }
  /** An action failed or cannot show the code; the message says why. */
  | { type: 'notice'; message: string }
  /** The page reports whether a badge is active (for example after a refresh by someone else). */
  | { type: 'synced'; active: boolean };

export const initialBadgePanelState = (active: boolean): BadgePanelState => ({ active, view: { kind: 'closed' } });

export function badgePanelReducer(state: BadgePanelState, event: BadgePanelEvent): BadgePanelState {
  switch (event.type) {
    case 'issued':
      return { active: true, view: { kind: 'shown', payload: event.payload, fresh: true } };
    case 'revealed':
      return { active: state.active, view: { kind: 'shown', payload: event.payload, fresh: false } };
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
