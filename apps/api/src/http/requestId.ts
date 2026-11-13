import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Keeps a caller's request id only if it is plain and short; otherwise makes one (this stops log injection). */
export function generateRequestId(req: IncomingMessage): string {
  const header = req.headers['x-request-id'];
  return typeof header === 'string' && SAFE_ID.test(header) ? header : randomUUID();
}
