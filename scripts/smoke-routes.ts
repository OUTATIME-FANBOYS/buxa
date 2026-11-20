/**
 * Smoke test for Next.js web routes:
 * 1. Discovers every page and route handler under apps/web/app from the filesystem.
 * 2. Starts `next start` on an available port (or uses an already running instance).
 * 3. Sends requests to each route expecting no 5xx errors.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAcceptedFailure, noDatabaseDeclared } from './smoke-rules';

/** Longest a single route may take to answer. Local routes answer in milliseconds; this only catches a stalled one. */
const REQUEST_TIMEOUT_MS = 20_000;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB_DIR = join(ROOT, 'apps', 'web');
const APP_DIR = join(WEB_DIR, 'app');

interface RouteTarget {
  file: string;
  type: 'PAGE' | 'API';
  url: string;
  method: 'GET' | 'POST';
}

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (entry.name === 'page.tsx' || entry.name === 'route.ts') {
      files.push(full);
    }
  }

  return files;
}

export function discoverRoutes(): RouteTarget[] {
  const files = walk(APP_DIR);
  const dummyUuid = '00000000-0000-0000-0000-000000000001';

  return files.map(file => {
    const rel = relative(APP_DIR, file).replace(/\\/g, '/');
    const parts = rel.split('/');
    const fileName = parts.pop()!;
    const isPage = fileName === 'page.tsx';

    // Filter out route groups like (app), (work), (admin), (operations)
    const routeParts = parts.filter(p => !(p.startsWith('(') && p.endsWith(')')));

    // Replace dynamic parameters like [classId], [id], [projectId] with dummy UUIDs
    const formattedParts = routeParts.map(p => p.replace(/\[(?:\.\.\.)?[^\]]+\]/g, dummyUuid));
    const urlPath = ('/' + formattedParts.join('/')).replace(/\/+/g, '/') || '/';

    // Route handlers that only support POST
    const isPostOnly = rel.includes('error-report') || rel.includes('v1/orgs');

    return {
      file: rel,
      type: isPage ? 'PAGE' : 'API',
      url: urlPath,
      method: isPostOnly ? 'POST' : 'GET',
    };
  });
}

function getFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close(() => resolvePort(port));
      } else {
        reject(new Error('Could not get free port'));
      }
    });
  });
}

async function waitForServer(url: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/health`, { redirect: 'manual' });
      if (res.status === 200) {
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for server at ${url} after ${timeoutMs}ms`);
}

async function main(): Promise<void> {
  if (!existsSync(join(WEB_DIR, '.next'))) {
    throw new Error('apps/web/.next not found. Run a build first (npm run build).');
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Starting smoke server on port ${port}...`);

  let child: ChildProcess | null = null;
  let alreadyRunning = false;

  try {
    const probe = await fetch(`${baseUrl}/health`, { redirect: 'manual' });
    if (probe.status === 200) {
      alreadyRunning = true;
      console.log(`Found existing server running at ${baseUrl}`);
    }
  } catch {
    // Not running, spawn it
  }

  if (!alreadyRunning) {
    child = spawn('npx', ['next', 'start', 'apps/web', '-p', String(port)], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'smoke-test-key',
      },
    });

    child.stderr?.on('data', data => {
      const line = data.toString();
      if (line.includes('Error')) {
        console.error(`[Server stderr] ${line.trim()}`);
      }
    });

    try {
      await waitForServer(baseUrl, 30000);
      console.log(`Server is ready at ${baseUrl}`);
    } catch (e) {
      child.kill('SIGTERM');
      throw e;
    }
  }

  const routes = discoverRoutes();
  console.log(`Discovered ${routes.length} routes to smoke test.\n`);

  const failures: { route: RouteTarget; status: number; text: string }[] = [];
  let passed = 0;

  try {
    for (const target of routes) {
      const targetUrl = `${baseUrl}${target.url}`;
      try {
        // A route that never answers must fail this check, not stall the job (seen in CI as a multi-hour hang).
        const res = await fetch(targetUrl, {
          method: target.method,
          redirect: 'manual',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: target.method === 'POST' ? { 'content-type': 'application/json' } : undefined,
          body: target.method === 'POST' ? JSON.stringify({}) : undefined,
        });

        const status = res.status;
        // Some routes need a database (see smoke-rules.ts). Only the cases the rule names are accepted; anything else is a failure.
        const accepted =
          status >= 500 &&
          isAcceptedFailure({ url: target.url, file: target.file, status }, noDatabaseDeclared(process.env));
        if (status >= 500 && !accepted) {
          const text = await res.text().catch(() => '');
          failures.push({ route: target, status, text });
          console.error(`  FAIL [${status}] ${target.method} ${target.url} (${target.file})`);
        } else {
          passed++;
          console.log(`  PASS [${status}] ${target.method} ${target.url}`);
        }
      } catch (reqError) {
        failures.push({ route: target, status: 0, text: String(reqError) });
        console.error(`  FAIL [ERROR] ${target.method} ${target.url} (${target.file}): ${String(reqError)}`);
      }
    }
  } finally {
    if (child) {
      console.log('\nStopping smoke server...');
      child.kill('SIGTERM');
    }
  }

  console.log(`\nSmoke test summary: ${passed} passed, ${failures.length} failed out of ${routes.length} routes.`);

  if (failures.length > 0) {
    throw new Error(`Smoke test failed: ${failures.length} route(s) returned 5xx or connection errors.`);
  }
}

const isEntry = Boolean(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url));
if (isEntry) {
  main().catch(error => {
    console.error(error.message || error);
    process.exit(1);
  });
}
