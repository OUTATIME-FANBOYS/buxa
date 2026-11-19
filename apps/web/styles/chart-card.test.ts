import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Prettier breaks rules over several lines, so each stylesheet is flattened to one line before matching.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\s+/g, ' ');
const charts = read('./features/kanban/charts.css');
const tokens = read('./tokens.css');
const light = tokens.slice(0, tokens.indexOf("[data-theme='dark']"));
const dark = tokens.slice(tokens.indexOf("[data-theme='dark']"));

/** Every .css, .ts and .tsx file under a folder, except this test. */
function sources(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(e => e.isFile() && /\.(css|tsx?)$/.test(e.name) && e.name !== 'chart-card.test.ts')
    .map(e => readFileSync(join(e.parentPath, e.name), 'utf8'));
}

describe('chart cards: hover', () => {
  it('change only the shadow on hover, not the position', () => {
    expect(charts).toContain('.chart-card:hover { box-shadow: var(--shadow); }');
  });
});

describe('no 3D tilt anywhere', () => {
  // A 3D move on hover: a perspective, a rotation about X, Y or Z, a 3D transform style, or the tilt tokens.
  const tilt = /rotate[XYZ]\(|rotate3d\(|perspective\(|preserve-3d|--tilt-/;

  it('leaves no tilt or perspective rule in the styles or the components', () => {
    const files = [
      ...sources(fileURLToPath(new URL('./', import.meta.url))),
      ...sources(fileURLToPath(new URL('../components/', import.meta.url))),
    ];
    expect(files.length).toBeGreaterThan(50);
    expect(files.filter(text => tilt.test(text))).toEqual([]);
  });
});

describe('chart card tokens', () => {
  it('define the card shadow and the area fade in light mode', () => {
    expect(light).toContain('--card-shadow:');
    expect(light).toContain('--chart-area-top:');
  });

  it('redefine the card shadow and area fade for dark mode', () => {
    expect(dark).toContain('--card-shadow:');
    expect(dark).toContain('--chart-area-top:');
  });
});
