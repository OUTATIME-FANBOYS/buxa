import type { ActionState } from '@/lib/actions/state';

/**
 * The state of the badge panel: an ordinary ActionState, plus the one moment a new badge is shown. `payload` is what the QR code
 * encodes. The token is never sent to the browser, and it is not kept after the panel is left or refreshed.
 */
export type BadgeState = ActionState | { status: 'issued'; payload: string };
