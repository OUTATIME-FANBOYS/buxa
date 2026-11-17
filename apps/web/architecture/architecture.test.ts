import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Rules from docs/CODING_STANDARDS.md (section 3): imports flow downward, layers are used through their barrels,
// logic never imports React, no cycles, and no client barrel reaches server-only code.

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

type Layer = 'app' | 'views' | 'components' | 'elements' | 'other';

// Frontend lives under components/: elements (smallest pieces), components (reusable composites) and views (whole screens).
// Hooks, providers, server and the pure helpers live in the other packages, so from this app's side they are all `other`.
const LAYER_DIRS: [string, Layer][] = [
  ['app/', 'app'], ['components/views/', 'views'], ['components/components/', 'components'], ['components/elements/', 'elements'],
];
const layerOf = (rel: string): Layer => {
  for (const [prefix, layer] of LAYER_DIRS) if (rel.startsWith(prefix)) return layer;
  return 'other';
};

/** Layers each layer may import from (itself included). `other` is config, styles and packages. */
const MAY_IMPORT: Record<string, Layer[]> = {
  elements: ['elements', 'other'],
  components: ['components', 'elements', 'other'],
  views: ['views', 'components', 'elements', 'other'],
  app: ['app', 'views', 'components', 'other'],
};

/** The export.ts of each layer's folder. Cross-layer imports must resolve to one of these. */
const BARREL_FILES: Partial<Record<Layer, string[]>> = {
  components: ['components/components/export.ts'], elements: ['components/elements/export.ts'], views: ['components/views/export.ts'],
};
/** Deep imports that are allowed on purpose. Each one is a reason in the PR body. */
const DEEP_ALLOWED = new Set<string>();

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
        if (BARREL_FILES[target]!.includes(to) || to.endsWith('/export.ts') || DEEP_ALLOWED.has(spec)) continue;
        bad.push(`${file} -> ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });


  it('elements do not hold domain knowledge: they import no components, views, hooks or providers', () => {
    const bad = [...edges].filter(([f]) => layerOf(f) === 'elements').flatMap(([f, l]) => l.filter((e) => ['components', 'views'].includes(layerOf(e.to))).map((e) => `${f} -> ${e.spec}`));
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
  const CLIENT_BARRELS = ['components/components/export.ts', 'components/elements/export.ts', 'components/views/export.ts'];
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

describe('components folders are used through their export.ts', () => {
  // Every folder under components/ (elements, components, views and their subfolders) has an export.ts that re-exports its
  // public items. A file outside a folder imports the folder's export.ts, never one of the files inside it.
  const COMPONENTS = 'components/';
  const folderOf = (file: string) => file.slice(0, file.lastIndexOf('/'));
  const insideFolder = (file: string, folder: string) => file === folder || file.startsWith(`${folder}/`);

  it('no file outside a components folder imports a file inside it (only its export.ts)', () => {
    const bad: string[] = [];
    for (const [file, list] of edges) {
      if (!file.startsWith(COMPONENTS) && !file.startsWith('app/') && !file.startsWith('components/')) continue;
      for (const { to, spec } of list) {
        if (!to.startsWith(COMPONENTS) || to.endsWith('/export.ts')) continue;
        const folder = folderOf(to);
        if (insideFolder(file, folder)) continue;
        bad.push(`${file} -> ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every folder under components/ that holds source files has an export.ts', () => {
    const folders = new Set(
      [...source.keys()].filter((f) => f.startsWith(COMPONENTS) && !/\/__tests__\/|\.test\.tsx?$/.test(f)).map(folderOf),
    );
    const missing = [...folders].filter((folder) => !source.has(`${folder}/export.ts`));
    expect(missing).toEqual([]);
  });
});
