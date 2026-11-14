/**
 * Badge tokens and QR rendering. Server-only because of the token helpers (node:crypto); a client component that only needs the
 * picture imports `@/lib/qr/svg` directly.
 */
export { generateCredentialToken, hashCredentialToken } from './tokens';
export { qrPath, qrSvg, type QrPath } from './svg';
