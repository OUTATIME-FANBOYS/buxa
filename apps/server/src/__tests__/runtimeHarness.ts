import { installRuntime, createRuntime, type Runtime, type RuntimeOptions } from '../runtime';
import { createMemoryRateLimiter } from '../rateLimit/limiter';

// Shared by the server's own tests and by the web app's route tests. It starts a runtime without importing any route, so the
// server package never depends on the web app.

export const BASE_ENV = {
  DATABASE_URL: 'postgres://u:p@127.0.0.1:1/none',
  NODE_ENV: 'test',
  LOG_LEVEL: 'info',
} as const;

/** Installs a runtime for the routes to use, capturing everything it logs. */
export function startRuntime(options: RuntimeOptions = {}): {
  runtime: Runtime;
  logs: string[];
  stop(): Promise<void>;
} {
  const logs: string[] = [];
  // Tests share no counters: each runtime gets its own in-memory limiter unless a test supplies one.
  const runtime = createRuntime({
    rateLimiter: createMemoryRateLimiter(),
    ...options,
    env: { ...BASE_ENV, ...options.env },
    logSink: line => {
      logs.push(line);
    },
  });
  installRuntime(runtime);

  return {
    runtime,
    logs,
    async stop() {
      installRuntime(undefined);
      await runtime.pool.end().catch(() => {});
    },
  };
}
