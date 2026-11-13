/**
 * Builds the Vercel deployment into `.vercel/output` (Build Output API v3): the web app as static files and the API as one
 * self-contained function. Run by Vercel as the project's build command, and locally with `npm run build:vercel`.
 *
 * On a production build it first applies database migrations. That runs before the new version can serve, and a failure
 * fails the build, so the previous deployment keeps serving. Preview builds never touch the database schema.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { FUNCTION_NAME, functionConfig, outputConfig } from './config';

const root = process.cwd();
const output = join(root, '.vercel', 'output');
const onVercel = process.env.VERCEL === '1';
const isProduction = process.env.VERCEL_ENV === 'production';

const env = (name: string) => process.env[name]?.trim() || undefined;

/** The web app needs the public Supabase settings at build time. The Supabase integration names them NEXT_PUBLIC_*; accept those too. */
function webBuildEnv(): NodeJS.ProcessEnv {
  const url = env('VITE_SUPABASE_URL') ?? env('NEXT_PUBLIC_SUPABASE_URL');
  const key = env('VITE_SUPABASE_PUBLISHABLE_KEY') ?? env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ?? env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (onVercel && (!url || !key)) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (public values) for the build; without them the app would show "Connect Supabase".');
  return { ...process.env, ...(url ? { VITE_SUPABASE_URL: url } : {}), ...(key ? { VITE_SUPABASE_PUBLISHABLE_KEY: key } : {}) };
}

async function applyMigrations(): Promise<void> {
  if (!isProduction) { console.log('Migrations: skipped (only production builds change the database schema)'); return; }
  const url = env('MIGRATION_DATABASE_URL') ?? env('DATABASE_URL');
  if (!url) throw new Error('Production build needs MIGRATION_DATABASE_URL (or DATABASE_URL) to apply database migrations.');
  const pool = new pg.Pool({ connectionString: url });
  try {
    const applied = await migrate(pool);
    console.log(applied.length ? `Migrations applied: ${applied.join(', ')}` : 'Migrations: up to date');
  } finally { await pool.end(); }
}

function buildWeb(): void {
  const result = spawnSync('npx', ['vite', 'build', 'apps/web'], { cwd: root, env: webBuildEnv(), stdio: 'inherit' });
  if (result.status !== 0) throw new Error('The web build failed.');
}

async function bundleFunction(dir: string): Promise<void> {
  await build({
    entryPoints: [join(root, 'apps/api/src/vercel.ts')],
    outfile: join(dir, 'index.mjs'),
    bundle: true, platform: 'node', format: 'esm', target: 'node22', minify: false, legalComments: 'none',
    tsconfig: join(root, 'tsconfig.json'),
    external: ['pg-native'], // an optional driver pg tries to load if present
    // Bundled CommonJS packages call require() for Node's built-ins; give them one.
    banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  });
}

async function main(): Promise<void> {
  await applyMigrations();

  rmSync(output, { recursive: true, force: true });
  buildWeb();
  const functionDir = join(output, 'functions', `${FUNCTION_NAME}.func`);
  mkdirSync(functionDir, { recursive: true });
  cpSync(join(root, 'apps/web/dist'), join(output, 'static'), { recursive: true });
  await bundleFunction(functionDir);
  writeFileSync(join(functionDir, '.vc-config.json'), JSON.stringify(functionConfig(), null, 2));
  writeFileSync(join(output, 'config.json'), JSON.stringify(outputConfig(), null, 2));

  const kb = (file: string) => `${Math.round(statSync(file).size / 1024)} kB`;
  console.log(`Output ready in .vercel/output (function ${kb(join(functionDir, 'index.mjs'))}, page ${kb(join(output, 'static', 'index.html'))})`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
