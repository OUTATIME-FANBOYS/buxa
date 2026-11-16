import 'server-only';
import { z } from 'zod';
import type { LogLevel } from './log';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string({ error: 'is required (see apps/web/.env.example)' }).refine(v => /^postgres(ql)?:\/\//.test(v), 'must be a postgres:// URL'),
  // The same public values the browser uses; see config/env.ts.
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production' && !env.NEXT_PUBLIC_SUPABASE_URL) {
    ctx.addIssue({ code: 'custom', path: ['NEXT_PUBLIC_SUPABASE_URL'], message: 'is required (see apps/web/.env.example)' });
  }
});

export interface Config {
  env: 'development' | 'test' | 'production';
  databaseUrl: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  /** Maximum database connections this instance opens. Keep (instances x this) under the database or pooler limit. */
  dbPoolMax: number;
  logLevel: LogLevel;
}

/** Reads and validates the environment once, so a bad deploy fails immediately and says why. Secrets are never echoed back. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const result = schema.safeParse(env);
  if (!result.success) {
    const lines = result.error.issues.map(i => `  ${i.path.join('.') || 'env'}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${lines.join('\n')}`);
  }
  const e = result.data;
  return { env: e.NODE_ENV, databaseUrl: e.DATABASE_URL, supabaseUrl: e.NEXT_PUBLIC_SUPABASE_URL, supabasePublishableKey: e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, dbPoolMax: e.DB_POOL_MAX, logLevel: e.LOG_LEVEL };
}
