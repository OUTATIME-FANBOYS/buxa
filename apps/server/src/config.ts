import 'server-only';
import { z } from 'zod';
import type { LogLevel } from './log';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z
      .string({ error: 'is required (see apps/web/.env.example)' })
      .refine(v => /^postgres(ql)?:\/\//.test(v), 'must be a postgres:// URL'),
    // The same public values the browser uses; see config/env.ts.
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    // Shows the dev outbox (invite emails, not sent). Off unless set to 1; production never sets it.
    ENABLE_DEV_OUTBOX: z.enum(['0', '1']).default('0'),
    // Guards the scheduled job routes (Vercel Cron sends it as a bearer token). Unset or too short, the job refuses; see holds/cronAuth.ts.
    CRON_SECRET: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.NEXT_PUBLIC_SUPABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_SUPABASE_URL'],
        message: 'is required (see apps/web/.env.example)',
      });
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
  /** True only when ENABLE_DEV_OUTBOX is 1. The dev outbox page answers not-found otherwise. */
  devOutboxEnabled: boolean;
  /** The scheduled-job secret, if one is set. Read by the job routes only, never sent to a browser. */
  cronSecret?: string;
}

/** Reads and validates the environment once, so a bad deploy fails immediately and says why. Secrets are never echoed back. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  // The migration login is read only by the migrate command. If it is the only database URL set, say so, because the
  // web app must never fall back to it.
  if (!env.DATABASE_URL && env.MIGRATION_DATABASE_URL) {
    throw new Error(
      'Invalid configuration:\n  DATABASE_URL: is required for the web app (the restricted runtime login). ' +
        'MIGRATION_DATABASE_URL is read only by the migrate command and is never used by the web app.',
    );
  }
  const result = schema.safeParse(env);
  if (!result.success) {
    const lines = result.error.issues.map(i => `  ${i.path.join('.') || 'env'}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${lines.join('\n')}`);
  }
  const e = result.data;

  return {
    env: e.NODE_ENV,
    databaseUrl: e.DATABASE_URL,
    supabaseUrl: e.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    dbPoolMax: e.DB_POOL_MAX,
    logLevel: e.LOG_LEVEL,
    devOutboxEnabled: e.ENABLE_DEV_OUTBOX === '1',
    cronSecret: e.CRON_SECRET,
  };
}
