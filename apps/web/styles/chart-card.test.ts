import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Prettier breaks rules over several lines, so each stylesheet is flattened to one line before matching.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\s+/g, ' ');
const charts = read('./features/kanban/charts.css');
const tokens = read('./tokens.css');
const light = tokens.slice(0, tokens.indexOf("[data-theme='dark']"));
const dark = tokens.slice(tokens.indexOf("[data-theme='dark']"));

describe('chart card tilt', () => {
  const motion = '@media (prefers-reduced-motion: no-preference) {';
  const hover = '.chart-card:hover {';

  it('lives only inside the motion-allowed media query, so reduced motion keeps the card flat', () => {
    const hoverAt = charts.indexOf(hover);
    expect(hoverAt).toBeGreaterThan(-1);
    expect(charts.indexOf(motion)).toBeGreaterThan(-1);
    expect(charts.indexOf(motion)).toBeLessThan(hoverAt);
    expect(charts.indexOf(hover)).toBe(charts.lastIndexOf(hover));
  });

  it('leans with the perspective and tilt tokens, not literal angles', () => {
    expect(charts).toContain(
      'transform: perspective(var(--tilt-perspective)) rotateX(var(--tilt-x)) rotateY(var(--tilt-y));',
    );
  });

  it('does not set a transform on the card outside the hover rule', () => {
    const base = charts.slice(charts.indexOf('.chart-card {'), charts.indexOf('.chart-card-head {'));
    expect(base).not.toContain('transform: perspective');
  });
});

describe('chart card tokens', () => {
  it('define the card shadow, the area fade and the tilt in light mode', () => {
    expect(light).toContain('--card-shadow:');
    expect(light).toContain('--chart-area-top:');
    expect(light).toContain('--tilt-x:');
  });

  it('redefine the card shadow and area fade for dark mode', () => {
    expect(dark).toContain('--card-shadow:');
    expect(dark).toContain('--chart-area-top:');
  });
});
