import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').replace(/\s+/g, ' ');
const light = tokens.slice(0, tokens.indexOf("[data-theme='dark']"));
const dark = tokens.slice(tokens.indexOf("[data-theme='dark']"));
const STATUSES = ['backlog', 'todo', 'progress', 'review', 'done'];

describe('status colour tokens', () => {
  it('define one colour per status in both the light and the dark theme', () => {
    for (const s of STATUSES) {
      expect(light).toMatch(new RegExp(`--st-${s}: #[0-9a-f]{6};`));
      expect(dark).toMatch(new RegExp(`--st-${s}: #[0-9a-f]{6};`));
    }
  });
  it('are distinct within each theme, so the dropdown never shows two statuses in one colour', () => {
    for (const block of [light, dark]) {
      const values = STATUSES.map(s => block.match(new RegExp(`--st-${s}: (#[0-9a-f]{6});`))?.[1]);
      expect(new Set(values).size).toBe(STATUSES.length);
    }
  });
});
