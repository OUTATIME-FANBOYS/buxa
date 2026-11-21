import 'server-only';
import { isHttpError } from '../../http/errors';
import type { BadgeReveal } from '../../services/credentials/CredentialService';
import type { ShowBadgeState } from '@buxa/shared';

/** The client's view of a service answer. The payload leaves the server only here, when someone pressed Show or Reprint. */
export function toShowBadgeState(reveal: BadgeReveal): ShowBadgeState {
  return reveal.kind === 'shown' ? { status: 'shown', payload: reveal.payload } : { status: 'reissue' };
}

/**
 * A refusal, a missing badge or a server without a badge key (503, whose message names the setting and no secret) is a message to
 * show. Anything else (a bug, the database being down) is rethrown for the boundary.
 */
export function showBadgeFailure(error: unknown): ShowBadgeState {
  if (!isHttpError(error) || (error.statusCode >= 500 && error.statusCode !== 503)) {
    throw error;
  }

  return { status: 'failed', message: error.message };
}
