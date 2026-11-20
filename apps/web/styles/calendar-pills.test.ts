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
    expect(calendar).toMatch(/\.cal-dot \{[^}]*flex: none;/);
  });
  it('give medium priority its own dark-mode token, distinct from the coral accent and the amber high token', () => {
    expect(dark).toContain('--p-medium: #7fd1d1;');
  });
  it('no longer set a priority colour on the pill: the priority icon takes its own token', () => {
    expect(calendar).not.toContain('prio-bg-');
    expect(calendar).not.toContain('--pc');
  });
  it('have no type tint: the body is the surface, and the priority dot is the only colour', () => {
    expect(calendar).not.toContain('cal-type');
    expect(calendar).not.toContain('--cal-bg');
    expect(light).not.toMatch(/--type-[1-5]:/);
    expect(dark).not.toMatch(/--type-[1-5]:/);
  });
});
