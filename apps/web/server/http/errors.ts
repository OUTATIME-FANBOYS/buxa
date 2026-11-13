/** An error a client should see: a status code and a message safe to show. Anything else becomes a generic 500. */
export class HttpError extends Error {
  constructor(readonly statusCode: number, message: string) { super(message); this.name = 'HttpError'; }
}
export const unauthorized = (message = 'Sign in required') => new HttpError(401, message);
export const forbidden = (message: string) => new HttpError(403, message);
export const notFound = (message: string) => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
export const badRequest = (message: string) => new HttpError(400, message);

const CODES: Readonly<Record<number, string>> = {
  400: 'bad_request', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 409: 'conflict',
  413: 'payload_too_large', 415: 'unsupported_media_type', 429: 'rate_limited', 500: 'internal',
};
export const codeFor = (status: number): string => CODES[status] ?? (status >= 500 ? 'internal' : 'bad_request');

/** The one error shape every response uses. */
export const errorBody = (status: number, message: string, requestId: string) => ({ error: { code: codeFor(status), message, requestId } });
