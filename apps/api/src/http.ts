import type { ZodType } from 'zod';

export function httpError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

/** Validates a request body; the first problem becomes a 400 the client can show. */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body ?? {});
  if (r.success) return r.data;
  const i = r.error.issues[0];
  throw httpError(400, `${i.path.join('.') || 'body'}: ${i.message}`);
}
