import type { ZodType } from 'zod';
import { badRequest, payloadTooLarge } from './errors';

/** The largest request body any route accepts. */
export const MAX_BODY_BYTES = 1_048_576;

/**
 * Reads the body as a stream and stops at `limit` bytes. The Content-Length header is only a hint, so a chunked request that
 * declares nothing is measured as it arrives, and the rest of it is never read.
 */
export async function readBody(request: Request, limit = MAX_BODY_BYTES): Promise<string> {
  if (!request.body) {
    return '';
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {}); // stop the client sending more
      throw payloadTooLarge();
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

/** Reads a JSON request body. An empty body is `undefined`; anything that is not valid JSON is a 400. */
export async function readJson(request: Request): Promise<unknown> {
  const text = await readBody(request);
  if (text === '') {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest('Request body must be valid JSON');
  }
}

/** Validates a request body; the first problem becomes a 400 the client can show. */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body ?? {});
  if (result.success) {
    return result.data;
  }
  const issue = result.error.issues[0];
  const field = issue.path.join('.') || 'body';
  throw badRequest(`${field}: ${issue.message}`);
}
