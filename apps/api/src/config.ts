import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string({ error: 'is required (see .env.example)' }).min(1, 'is required (see .env.example)').refine(v => /^postgres(ql)?:\/\//.test(v), 'must be a postgres:// URL'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8788),
  HOST: z.string().min(1).default('127.0.0.1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});
export type Config = z.infer<typeof schema>;

/** Reads and validates the environment once, at start-up, so a bad deploy fails immediately and says why. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const r = schema.safeParse(env);
  if (r.success) return r.data;
  const lines = r.error.issues.map(i => `  ${i.path.join('.') || 'env'}: ${i.message}`);
  throw new Error(`Invalid configuration:\n${lines.join('\n')}`);
}
