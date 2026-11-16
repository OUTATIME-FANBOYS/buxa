/** An error a client should see: a status code and a message safe to show. Anything else becomes a generic 500. */
export class HttpError extends Error {
  /** How the error is recognised. Next.js can load this file more than once (per route), so `instanceof` is unreliable; see isHttpError. */
  readonly kind = 'http-error';
  /** Set on 429: whole seconds until the client may try again. */
  retryAfterSeconds?: number;
  constructor(readonly statusCode: number, message: string) { super(message); this.name = 'HttpError'; }
}

/** True for an HttpError from any copy of this module. Use this, never `instanceof HttpError`. */
export const isHttpError = (error: unknown): error is HttpError =>
  error instanceof Error && (error as { kind?: unknown }).kind === 'http-error' && typeof (error as { statusCode?: unknown }).statusCode === 'number';
export const unauthorized = (message = 'Sign in required') => new HttpError(401, message);
export const forbidden = (message: string) => new HttpError(403, message);
export const notFound = (message: string) => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
export const badRequest = (message: string) => new HttpError(400, message);
export const payloadTooLarge = (message = 'Request body too large') => new HttpError(413, message);

/** A 429 that tells the client when to retry. The route sends it as the Retry-After header. */
export function tooManyRequests(retryAfterSeconds: number, message: string): HttpError {
  const error = new HttpError(429, message);
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

const CODES: Readonly<Record<number, string>> = {
  400: 'bad_request', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 409: 'conflict',
  413: 'payload_too_large', 415: 'unsupported_media_type', 429: 'rate_limited', 500: 'internal',
};
export const codeFor = (status: number): string => CODES[status] ?? (status >= 500 ? 'internal' : 'bad_request');

/** The one error shape every response uses. */
export const errorBody = (status: number, message: string, requestId: string) => ({ error: { code: codeFor(status), message, requestId } });
