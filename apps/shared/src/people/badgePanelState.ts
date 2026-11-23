/**
 * What the badge panel shows, as one value. `closed` shows no code. `shown` holds the QR payload for as long as it is on screen,
 * and only after Show or Reprint. `done` is a short confirmation of the last action (for example "Badge reissued."). `notice` is an
 * error message. Issuing or revoking clears any code, so a code never stays on screen past the action that replaced it.
 */
export type BadgeView =
  | { kind: 'closed' }
  | { kind: 'shown'; payload: string }
  | { kind: 'done'; message: string }
  | { kind: 'notice'; message: string };

export interface BadgePanelState {
  /** Whether the person holds an active badge, as far as this panel knows it. */
  active: boolean;
  view: BadgeView;
}

export type BadgePanelEvent =
  /** A badge was issued. `replaced` is true when it replaced an active badge (a reissue). No code is shown. */
  | { type: 'issued'; replaced: boolean }
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
      return { active: true, view: { kind: 'done', message: event.replaced ? 'Badge reissued.' : 'Badge issued.' } };
    case 'revealed':
      return { active: state.active, view: { kind: 'shown', payload: event.payload } };
    case 'revoked':
      return { active: false, view: { kind: 'done', message: 'Badge revoked.' } };
    case 'closed':
      return { active: state.active, view: { kind: 'closed' } };
    case 'notice':
      return { active: state.active, view: { kind: 'notice', message: event.message } };
    case 'synced':
      return event.active === state.active ? state : { active: event.active, view: { kind: 'closed' } };
  }
}
