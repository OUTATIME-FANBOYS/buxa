import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROLE_HUE, TONE_HUE } from '@buxa/shared';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\s+/g, ' ');
const tokens = read('./tokens.css');
const pill = read('./components/pill.css');
const light = tokens.slice(0, tokens.indexOf("[data-theme='dark']"));
const dark = tokens.slice(tokens.indexOf("[data-theme='dark']"));
const HUES = [...new Set([...Object.values(TONE_HUE), ...Object.values(ROLE_HUE)])];
const SURFACE = { light: '#f0f3f6', dark: '#272932' };

const hex = (block: string, name: string) => block.match(new RegExp(`--${name}: (#[0-9a-f]{6});`))?.[1] ?? '';
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

describe('tone and role classes follow the hue maps in shared/src/tones.ts', () => {
  it('set each tone class to its hue, so the CSS and the map cannot drift apart', () => {
    for (const [tone, hue] of Object.entries(TONE_HUE)) {
      expect(tokens).toMatch(new RegExp(`\\.tone-${tone} \\{[^}]*--tone: var\\(--hue-${hue}\\);`));
    }
    for (const [role, hue] of Object.entries(ROLE_HUE)) {
      expect(tokens).toMatch(new RegExp(`\\.tone-${role} \\{[^}]*--tone: var\\(--hue-${hue}\\);`));
    }
  });
  it('define every hue in both themes', () => {
    for (const h of HUES) {
      for (const block of [light, dark]) {
        expect(hex(block, `hue-${h}`)).toMatch(/^#/);
        expect(hex(block, `hue-${h}-ink`)).toMatch(/^#/);
      }
    }
  });
});

describe('pill text contrast', () => {
  it('is 4.5:1 or better in light mode: the ink on the 18% tint', () => {
    for (const h of HUES) {
      const glass = over(hex(light, `hue-${h}`), SURFACE.light, 0.18);
      expect(contrast(hex(light, `hue-${h}-ink`), glass), h).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('is 4.5:1 or better in dark mode: the paler ink on the 16% glass', () => {
    for (const h of HUES) {
      const glass = over(hex(dark, `hue-${h}`), SURFACE.dark, 0.16);
      expect(contrast(hex(dark, `hue-${h}-ink`), glass), h).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('pill look', () => {
  it('has no border in either theme: the colour carries the shape', () => {
    expect(pill).toMatch(/\.pill \{[^}]*background: var\(--tone-soft\);[^}]*border: 0;/);
    expect(pill).not.toMatch(/1px solid/);
  });
  it('keeps the blur and the top highlight', () => {
    expect(pill).toMatch(/backdrop-filter: blur\(12px\)/);
    expect(pill).toMatch(/inset 0 1px 0 var\(--glass-highlight\)/);
  });
});
