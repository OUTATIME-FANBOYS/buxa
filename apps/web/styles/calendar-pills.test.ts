import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Prettier breaks rules over several lines, so each stylesheet is flattened to one line before matching.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\s+/g, ' ');
const calendar = read('./features/kanban/calendar.css');
const tokens = read('./tokens.css');
const light = tokens.slice(0, tokens.indexOf("[data-theme='dark']"));
const dark = tokens.slice(tokens.indexOf("[data-theme='dark']"));

describe('calendar task pills', () => {
  it('are a 22px row with an 11px label, and keep the 44px touch target on a coarse pointer', () => {
    expect(calendar).toContain('height: 22px;');
    expect(calendar).toContain('font-size: 11px;');
    expect(calendar).toContain('.cal-task { height: var(--control-touch); }');
  });
  it('start their text at the dot, so a short title is not centred and indented', () => {
    expect(calendar).toMatch(/\.cal-task \{[^}]*justify-content: flex-start;/);
    expect(calendar).toMatch(/\.cal-dot \{[^}]*background: var\(--pc, var\(--p-low\)\);/);
  });
  it('give medium priority its own dark-mode token, distinct from the coral accent and the amber high token', () => {
    expect(dark).toContain('--p-medium: #7fd1d1;');
  });
  it('take the priority colour on the dot from the existing priority tokens', () => {
    for (const p of ['low', 'medium', 'high', 'critical']) {
      expect(calendar).toContain(`.cal-task.prio-bg-${p} { --pc: var(--p-${p}); }`);
    }
  });
  it('define five pastel type tints in both the light and the dark theme', () => {
    for (let n = 1; n <= 5; n++) {
      expect(calendar).toContain(`.cal-task.cal-type-${n} { --cal-bg: var(--type-${n}); }`);
      expect(light).toMatch(new RegExp(`--type-${n}: #[0-9a-f]{6};`));
      expect(dark).toMatch(new RegExp(`--type-${n}: #[0-9a-f]{6};`));
    }
  });
});
