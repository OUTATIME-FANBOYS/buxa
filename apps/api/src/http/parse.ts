import type { ZodType } from 'zod';
import { badRequest } from './errors';

/** Validates a request body; the first problem becomes a 400 the client can show. */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue.path.join('.') || 'body';
  throw badRequest(`${field}: ${issue.message}`);
}
