import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Rules from docs/architecture/folders.md: imports flow downward, layers are used through their barrels,
// logic never imports React, no cycles, and no client barrel reaches server-only code.

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

type Layer = 'app' | 'views' | 'components' | 'elements' | 'hooks' | 'providers' | 'logic/common' | 'logic/composers' | 'server' | 'other';

const LAYER_DIRS: [string, Layer][] = [
  ['app/', 'app'], ['views/', 'views'], ['components/', 'components'], ['elements/', 'elements'], ['hooks/', 'hooks'],
  ['providers/', 'providers'], ['logic/common/', 'logic/common'], ['logic/composers/', 'logic/composers'], ['server/', 'server'],
];
const layerOf = (rel: string): Layer => {
  for (const [prefix, layer] of LAYER_DIRS) if (rel.startsWith(prefix)) return layer;
  return 'other';
};

/** Layers each layer may import from (itself included). `other` is config, styles and packages. */
const MAY_IMPORT: Record<string, Layer[]> = {
  elements: ['elements', 'logic/common', 'other'],
  components: ['components', 'elements', 'hooks', 'providers', 'logic/common', 'logic/composers', 'other'],
  hooks: ['hooks', 'components', 'elements', 'providers', 'logic/common', 'logic/composers', 'other'],
  providers: ['providers', 'components', 'elements', 'hooks', 'logic/common', 'logic/composers', 'other'],
  views: ['views', 'components', 'elements', 'hooks', 'providers', 'logic/common', 'logic/composers', 'other'],
  app: ['app', 'views', 'components', 'providers', 'server', 'other'],
  'logic/composers': ['logic/composers', 'logic/common', 'server', 'other'],
  'logic/common': ['logic/common', 'other'],
};

/** The barrel file of each layer. Cross-layer imports must resolve to one of these. */
const BARREL_FILES: Partial<Record<Layer, string[]>> = {
  components: ['components/export.ts'], elements: ['elements/export.ts'], views: ['views/export.ts'], hooks: ['hooks/hooks.ts'],
  providers: ['providers/providers.ts'], 'logic/common': ['logic/common/index.ts'], 'logic/composers': ['logic/composers/index.ts', 'logic/composers/index.server.ts'],
};
/** Deep imports that are allowed on purpose. Each one is a reason in the PR body. */
const DEEP_ALLOWED = new Set<string>([
  '@/providers/UiProvider', // useUi: deep so providers do not form a cycle with the components barrel
  '@/components/Dialog', // imported by providers/UiProvider for the same cycle
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.') || entry === '__tests__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) && !entry.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

const rel = (abs: string) => relative(WEB, abs).split(sep).join('/');
const files = walk(WEB).filter((f) => !rel(f).startsWith('.next') && !rel(f).startsWith('legacy-server') && !rel(f).startsWith('architecture/'));
const source = new Map(files.map((f) => [rel(f), readFileSync(f, 'utf8')]));

/** Runtime (non-type) static imports of a file, with the alias or relative specifier as written. */
function importsOf(text: string): string[] {
  const out: string[] = [];
  const re = /^\s*(import|export)\s+(?!type\s)([^;]*?)\s*from\s+['"]([^'"]+)['"]/gm;
  for (const m of text.matchAll(re)) {
    // `import { type A, type B }` is type-only and erased at build time
    const named = /\{([^}]*)\}/.exec(m[2]);
    if (named && named[1].split(',').every((x) => x.trim() === '' || x.trim().startsWith('type '))) continue;
    out.push(m[3]);
  }
  for (const m of text.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) out.push(m[1]);
  return out;
}

/** Resolves an alias or relative specifier to a repository-relative source file, or null for packages. */
function resolveSpec(spec: string, fromRel: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(WEB, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(join(WEB, fromRel)), spec);
  else return null;
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx'), `${base}.server.ts`]) {
    if (existsSync(cand) && statSync(cand).isFile()) return rel(cand);
  }
  return null;
}

const edges = new Map<string, { to: string; spec: string }[]>();
for (const [file, text] of source) {
  edges.set(file, importsOf(text).flatMap((spec) => {
    const to = resolveSpec(spec, file);
    return to ? [{ to, spec }] : [];
  }));
}

describe('layer rules', () => {
  it('imports only go downward, between the layers each layer may use', () => {
    const bad: string[] = [];
    for (const [file, list] of edges) {
      const from = layerOf(file);
      const allowed = MAY_IMPORT[from];
      if (!allowed) continue;
      for (const { to, spec } of list) {
        const target = layerOf(to);
        if (!allowed.includes(target)) bad.push(`${file} (${from}) -> ${spec} (${target})`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('layers are used through their barrels, except the deliberate exceptions', () => {
    const bad: string[] = [];
    for (const [file, list] of edges) {
      const from = layerOf(file);
      for (const { to, spec } of list) {
        const target = layerOf(to);
        if (target === from || !BARREL_FILES[target]) continue;
        if (BARREL_FILES[target]!.includes(to) || DEEP_ALLOWED.has(spec)) continue;
        bad.push(`${file} -> ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('logic never imports React or React DOM, and logic/common never imports Next; composers are the server actions and may use Next', () => {
    const bad: string[] = [];
    for (const file of source.keys()) {
      if (!file.startsWith('logic/')) continue;
      if (file.endsWith('.tsx')) bad.push(file);
      const nextBanned = layerOf(file) === 'logic/common';
      for (const spec of importsOf(source.get(file)!)) {
        if (/^react(-dom)?(\/|$)/.test(spec) || (nextBanned && /^next(\/|$)/.test(spec))) bad.push(`${file} -> ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('elements do not hold domain knowledge: they import no components, views, hooks or providers', () => {
    const bad = [...edges].filter(([f]) => layerOf(f) === 'elements').flatMap(([f, l]) => l.filter((e) => ['components', 'views', 'hooks', 'providers'].includes(layerOf(e.to))).map((e) => `${f} -> ${e.spec}`));
    expect(bad).toEqual([]);
  });
});

describe('cycles', () => {
  it('the import graph has no cycles', () => {
    const state = new Map<string, number>();
    const stack: string[] = [];
    const cycles: string[] = [];
    const visit = (node: string) => {
      state.set(node, 1); stack.push(node);
      for (const { to } of edges.get(node) ?? []) {
        const s = state.get(to);
        if (s === 1) cycles.push([...stack.slice(stack.indexOf(to)), to].join(' -> '));
        else if (s === undefined) visit(to);
      }
      stack.pop(); state.set(node, 2);
    };
    for (const node of edges.keys()) if (!state.has(node)) visit(node);
    expect(cycles).toEqual([]);
  });
});

describe('server-only code stays out of client barrels', () => {
  const CLIENT_BARRELS = ['components/export.ts', 'elements/export.ts', 'logic/common/index.ts', 'logic/composers/index.ts', 'hooks/hooks.ts', 'providers/providers.ts'];
  const isServerOnly = (file: string) => /from ['"]server-only['"]|import ['"]server-only['"]/.test(source.get(file) ?? '');
  const isUseServer = (file: string) => /^\s*(['"])use server\1/.test(source.get(file) ?? '');

  it.each(CLIENT_BARRELS)('%s does not reach a server-only module through runtime imports', (barrel) => {
    const seen = new Set<string>();
    const hits: string[] = [];
    const walkFrom = (file: string, path: string[]) => {
      if (seen.has(file)) return;
      seen.add(file);
      if (isServerOnly(file)) { hits.push([...path, file].join(' -> ')); return; }
      if (isUseServer(file) && file !== barrel) return; // server actions are RPC stubs on the client
      for (const { to } of edges.get(file) ?? []) if (source.has(to)) walkFrom(to, [...path, file]);
    };
    walkFrom(barrel, []);
    expect(hits).toEqual([]);
  });
});
