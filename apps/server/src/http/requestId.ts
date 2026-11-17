const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Keeps a caller's request id only if it is plain and short; otherwise makes one (this stops log injection). */
export function generateRequestId(headers: Headers): string {
  const given = headers.get('x-request-id');
  return given !== null && SAFE_ID.test(given) ? given : crypto.randomUUID();
}
