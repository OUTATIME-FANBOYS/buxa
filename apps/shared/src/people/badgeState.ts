import type { ActionState } from '../actionState';

/**
 * The state of the badge panel: an ordinary ActionState, plus the one moment a new badge is shown. `payload` is what the QR code
 * encodes. The token is never sent to the browser, and it is not kept after the panel is left or refreshed.
 */
export type BadgeState = ActionState | { status: 'issued'; payload: string };

/**
 * What showing or reprinting a badge returns. `shown` carries the QR payload, sent only when someone presses Show or Reprint.
 * `reissue` means the badge has no encrypted copy (it was issued before one existed): the camp must reissue it to show it.
 */
export type ShowBadgeState =
  { status: 'shown'; payload: string } | { status: 'reissue' } | { status: 'failed'; message: string };

/** One row of the profile's badge section: names and whether a badge is active. No code is ever part of it. */
export interface ProfileBadgeRow {
  personId: string;
  name: string;
  roleLabel: string;
  hasActiveBadge: boolean;
  /** True for the signed-in person's own record; false for a child of theirs. */
  self: boolean;
}
