import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').replace(/\s+/g, ' ');
const light = tokens.slice(0, tokens.indexOf("[data-theme='dark']"));
const dark = tokens.slice(tokens.indexOf("[data-theme='dark']"));
const COLOURS = ['pink', 'blue', 'orange', 'purple', 'green'];
const TINT = 0.18; // the liquid-glass tint: the status colour at 18% over the surface (status.css)

const hex = (block: string, name: string) => block.match(new RegExp(`--${name}: (#[0-9a-f]{6});`))?.[1];
const channel = (h: string, i: number) => Number.parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) / 255;
const luminance = (h: string) => {
  const [r, g, b] = [0, 1, 2].map(i => {
    const c = channel(h, i);

    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const over = (fg: string, bg: string, a: number) =>
  '#' +
  [0, 1, 2]
    .map(i =>
      Math.round((channel(fg, i) * a + channel(bg, i) * (1 - a)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (hi + 0.05) / (lo + 0.05);
};

describe('status colour tokens', () => {
  it('define one colour and one ink per status colour, in both the light and the dark theme', () => {
    for (const c of COLOURS) {
      for (const block of [light, dark]) {
        expect(hex(block, `status-${c}`)).toMatch(/^#/);
        expect(hex(block, `status-${c}-ink`)).toMatch(/^#/);
      }
    }
  });
  it('keep the five colours distinct within each theme, so no two statuses look alike', () => {
    for (const block of [light, dark]) {
      const values = COLOURS.map(c => hex(block, `status-${c}`));
      expect(new Set(values).size).toBe(COLOURS.length);
    }
  });
  it('keep the status text at 6:1 or better on its glass, in both themes', () => {
    for (const block of [light, dark]) {
      const surface = hex(block, 'surface');
      expect(surface).toBeDefined();
      for (const c of COLOURS) {
        const glass = over(hex(block, `status-${c}`) ?? '', surface ?? '', TINT);
        expect(contrast(hex(block, `status-${c}-ink`) ?? '', glass)).toBeGreaterThanOrEqual(6);
      }
    }
  });
  it('give the glass a thin light edge and a soft top highlight in both themes', () => {
    for (const block of [light, dark]) {
      expect(block).toMatch(/--glass-edge: rgba\(/);
      expect(block).toMatch(/--glass-highlight: rgba\(/);
    }
  });
});
