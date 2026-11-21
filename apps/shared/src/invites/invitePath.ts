import { ROUTES } from '../config/routes';

/** Where an invite link lives: /invite/<token>. The token only ever holds base64url characters, so it needs no escaping. */
export const invitePath = (token: string): string => `/invite/${encodeURIComponent(token)}`;

const INVITE_PATH = /^\/invite\/[A-Za-z0-9_-]{43}$/;

/**
 * The page to go to after sign-in. Only an invite path of this app is allowed, so a `next` value cannot send someone to
 * another site. Anything else goes to the camp home.
 */
export function safeNext(value: string | null | undefined): string {
  return value && INVITE_PATH.test(value) ? value : ROUTES.camp;
}

/** The camp's dev outbox page. It exists only when ENABLE_DEV_OUTBOX is 1. */
export const DEV_OUTBOX_PATH = '/camp/team/outbox';
