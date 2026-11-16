import type { ZodType } from 'zod';
import { badRequest } from './errors';

/** Reads a JSON request body. An empty body is `undefined`; anything that is not valid JSON is a 400. */
export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text === '') return undefined;
  try { return JSON.parse(text); } catch { throw badRequest('Request body must be valid JSON'); }
}

/** Validates a request body; the first problem becomes a 400 the client can show. */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue.path.join('.') || 'body';
  throw badRequest(`${field}: ${issue.message}`);
}
