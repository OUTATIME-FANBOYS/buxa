/**
 * The badge's QR code carries an opaque token and nothing about the person. 128 bits from a CSPRNG, base64url (22 characters).
 * The server stores only a SHA-256 hash of it. The prefix lets a scanner tell a Buxa badge from any other code.
 */
export const CREDENTIAL_TOKEN_BYTES = 16;
export const CREDENTIAL_PREFIX = 'bx1.';
const TOKEN = /^[A-Za-z0-9_-]{22}$/;

export const isCredentialToken = (value: unknown): value is string => typeof value === 'string' && TOKEN.test(value);

/** What is printed in the QR code. */
export const credentialPayload = (token: string): string => `${CREDENTIAL_PREFIX}${token}`;

/**
 * The token inside whatever a scanner typed or the camera read, or null if it is not a Buxa badge. Surrounding whitespace
 * (a scanner's trailing Enter) is ignored. The caller answers `null` and an unknown token identically.
 */
export function parseCredentialPayload(raw: string): string | null {
  const text = raw.trim();
  if (!text.startsWith(CREDENTIAL_PREFIX)) return null;
  const token = text.slice(CREDENTIAL_PREFIX.length);
  return isCredentialToken(token) ? token : null;
}
