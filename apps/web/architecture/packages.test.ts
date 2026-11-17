import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Rules for the four packages (apps/web, apps/middleware, apps/shared, apps/server) and the three shared libraries in packages/.
// Dependencies point one way: web -> middleware -> shared, and web -> server -> shared. Client code never reaches the server package.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

type Pkg = 'web' | 'middleware' | 'shared' | 'server' | 'domain' | 'contracts' | 'db' | 'other';

/** The packages each package may import (itself included). Anything else is a violation. */
const MAY_IMPORT: Record<Pkg, Pkg[]> = {
  web: ['web', 'middleware', 'shared', 'server', 'domain', 'contracts', 'db'],
  middleware: ['middleware', 'shared', 'domain', 'contracts'],
  server: ['server', 'shared', 'domain', 'contracts', 'db'],
  shared: ['shared', 'domain', 'contracts'],
  domain: ['domain'],
  contracts: ['contracts', 'domain'],
  db: ['db', 'domain'],
  other: ['other', 'web', 'middleware', 'shared', 'server', 'domain', 'contracts', 'db'],
};

/** Packages that must not import these external modules at all. */
const BANNED_EXTERNAL: Partial<Record<Pkg, RegExp>> = {
  shared: /^(react|react-dom|next|pg|server-only|@buxa\/db)(\/|$)/,
  middleware: /^(pg|server-only|@buxa\/db)(\/|$)/,
};

const PKG_DIRS: [string, Pkg][] = [
  ['apps/web/', 'web'], ['apps/middleware/src/', 'middleware'], ['apps/shared/src/', 'shared'], ['apps/server/src/', 'server'],
  ['packages/domain/', 'domain'], ['packages/contracts/', 'contracts'], ['packages/db/', 'db'],
];
const pkgOf = (rel: string): Pkg => {
  for (const [prefix, pkg] of PKG_DIRS) if (rel.startsWith(prefix)) return pkg;
  return 'other';
};

const SRC_ROOTS = ['apps/web', 'apps/middleware/src', 'apps/shared/src', 'apps/server/src', 'packages'];
const SKIP = new Set(['node_modules', '.next', '.git']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

const rel = (abs: string) => relative(ROOT, abs).split(sep).join('/');
const isTest = (file: string) => /\/__tests__\/|\.test\.tsx?$/.test(file);
const files = SRC_ROOTS.flatMap((r) => walk(join(ROOT, r))).map(rel).filter((f) => !f.startsWith('apps/web/architecture/'));
const source = new Map(files.map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]));

/** A runtime import: `import type` and imports whose named bindings are all types are erased, so they are skipped. */
function runtimeSpecs(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/^\s*(import|export)\s+(type\s+)?([^;]*?)\s*from\s+['"]([^'"]+)['"]/gm)) {
    if (m[2]) continue;
    const named = /\{([^}]*)\}/.exec(m[3]);
    if (named && named[1].split(',').every((x) => x.trim() === '' || x.trim().startsWith('type '))) continue;
    out.push(m[4]);
  }
  for (const m of text.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) out.push(m[1]);
  for (const m of text.matchAll(/vi\.mock\(\s*['"]([^'"]+)['"]/g)) out.push(m[1]);
  return out;
}

const SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
function firstExisting(base: string): string | null {
  for (const s of SUFFIXES) {
    const candidate = base + s;
    if (existsSync(candidate) && statSync(candidate).isFile()) return rel(candidate);
  }
  return null;
}

/** Resolves a specifier to a repository file, a package name (external or a shared library), or null when it is external. */
function resolveSpec(spec: string, from: string): { file?: string; pkg?: Pkg; external?: boolean } {
  if (spec.startsWith('@/')) return { file: firstExisting(join(ROOT, 'apps/web', spec.slice(2))) ?? undefined, pkg: 'web' };
  if (spec.startsWith('.')) {
    const file = firstExisting(resolve(dirname(join(ROOT, from)), spec));
    return file ? { file, pkg: pkgOf(file) } : { external: true };
  }
  const m = /^@buxa\/(shared|server|middleware)(\/.*)?$/.exec(spec);
  if (m) {
    const dir = { shared: 'apps/shared/src', server: 'apps/server/src', middleware: 'apps/middleware/src' }[m[1] as 'shared' | 'server' | 'middleware'];
    const sub = (m[2] ?? '').slice(1);
    const file = firstExisting(join(ROOT, dir, sub));
    return { file: file ?? undefined, pkg: m[1] as Pkg };
  }
  const lib = /^@buxa\/(domain|contracts|db)(\/.*)?$/.exec(spec);
  if (lib) return { pkg: lib[1] as Pkg };
  return { external: true };
}

interface Edge { to: Pkg; spec: string; file?: string }
const edges = new Map<string, Edge[]>();
for (const [file, text] of source) {
  const list: Edge[] = [];
  for (const spec of runtimeSpecs(text)) {
    const r = resolveSpec(spec, file);
    if (r.external) continue;
    list.push({ to: r.pkg ?? pkgOf(r.file ?? ''), spec, file: r.file });
  }
  edges.set(file, list);
}

describe('package dependency direction', () => {
  it('every package imports only the packages its layer may use', () => {
    const bad: string[] = [];
    for (const [file, list] of edges) {
      const from = pkgOf(file);
      for (const { to, spec } of list) {
        if (!MAY_IMPORT[from].includes(to)) bad.push(`${file} (${from}) -> ${spec} (${to})`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('shared and server never import apps/web or apps/middleware, and shared never imports React or the database', () => {
    const bad: string[] = [];
    for (const [file, list] of edges) {
      const from = pkgOf(file);
      if (from !== 'shared' && from !== 'server') continue;
      for (const { to, spec } of list) if (to === 'web' || to === 'middleware') bad.push(`${file} -> ${spec}`);
    }
    for (const [file, text] of source) {
      const banned = BANNED_EXTERNAL[pkgOf(file)];
      if (!banned) continue;
      for (const spec of runtimeSpecs(text)) if (banned.test(spec)) bad.push(`${file} -> ${spec}`);
    }
    expect(bad).toEqual([]);
  });

  it('packages reach each other by package name, never by a relative path that crosses a package', () => {
    const bad: string[] = [];
    for (const [file, list] of edges) {
      const from = pkgOf(file);
      for (const { spec, file: target } of list) {
        if (!spec.startsWith('.') || !target) continue;
        if (pkgOf(target) !== from) bad.push(`${file} -> ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('the package graph has no cycles', () => {
    const graph = new Map<Pkg, Set<Pkg>>();
    for (const [file, list] of edges) {
      const from = pkgOf(file);
      if (!graph.has(from)) graph.set(from, new Set());
      for (const { to } of list) if (to !== from) graph.get(from)!.add(to);
    }
    const state = new Map<Pkg, number>();
    const stack: Pkg[] = [];
    const cycles: string[] = [];
    const visit = (node: Pkg) => {
      state.set(node, 1); stack.push(node);
      for (const next of graph.get(node) ?? []) {
        const s = state.get(next);
        if (s === 1) cycles.push([...stack.slice(stack.indexOf(next)), next].join(' -> '));
        else if (s === undefined) visit(next);
      }
      stack.pop(); state.set(node, 2);
    };
    for (const node of graph.keys()) if (!state.has(node)) visit(node);
    expect(cycles).toEqual([]);
  });
});

describe('client code never reaches the server package', () => {
  // Client code: every module marked 'use client', and everything in the middleware package (hooks and providers run in the browser).
  // A 'use server' file is a boundary: its body runs on the server, and the client only holds a reference to it.
  const isUseClient = (file: string) => /^\s*['"]use client['"]/m.test(source.get(file) ?? '');
  const isUseServer = (file: string) => /^\s*['"]use server['"]/m.test(source.get(file) ?? '');
  const roots = [...source.keys()].filter((f) => !isTest(f) && (pkgOf(f) === 'middleware' || (pkgOf(f) === 'web' && isUseClient(f))));

  it('no module reachable from client code imports @buxa/server or a server-only module', () => {
    const seen = new Set<string>();
    const hits: string[] = [];
    const queue: { file: string; path: string[] }[] = roots.map((file) => ({ file, path: [] }));
    while (queue.length) {
      const { file, path } = queue.shift()!;
      if (seen.has(file)) continue;
      seen.add(file);
      const here = [...path, file];
      for (const { to, spec, file: target } of edges.get(file) ?? []) {
        if (to === 'server') { hits.push(`${here.join(' -> ')} -> ${spec}`); continue; }
        if (!target || isUseServer(target)) continue;
        if (isTest(target)) continue;
        if (source.has(target)) queue.push({ file: target, path: here });
      }
    }
    expect(hits).toEqual([]);
  });

  it('the roots of client code are found (the check is not vacuous)', () => {
    expect(roots.length).toBeGreaterThan(20);
    expect(roots).toContain('apps/web/components/components/attendance/CheckInConsole.tsx');
  });
});

describe('workspace packages', () => {
  it('each package has a package.json with its name, and the root workspaces list includes them', () => {
    const root = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { workspaces: string[] };
    const expected: [string, string][] = [
      ['apps/shared', '@buxa/shared'], ['apps/server', '@buxa/server'], ['apps/middleware', '@buxa/middleware'],
    ];
    for (const [dir, name] of expected) {
      expect(root.workspaces).toContain(dir);
      const manifest = JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8')) as { name: string };
      expect(manifest.name).toBe(name);
    }
  });
});
