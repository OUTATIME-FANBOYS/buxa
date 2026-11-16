import { describe, expect, it } from 'vitest';
import { project, rubberband } from '@/lib/motion';

describe('project', () => {
  it('is zero at rest and odd in the velocity', () => {
    expect(project(0)).toBe(0);
    expect(project(-800)).toBeCloseTo(-project(800));
  });
  it('matches the exponential-deceleration formula', () => {
    expect(project(1000)).toBeCloseTo(0.998 / 0.002);
  });
  it('rests further for a faster flick or a higher rate', () => {
    expect(project(1200)).toBeGreaterThan(project(600));
    expect(project(600, 0.99)).toBeLessThan(project(600, 0.998));
  });
});

describe('rubberband', () => {
  it('is zero at the boundary and grows with distance, always less than 1:1', () => {
    expect(rubberband(0, 300)).toBe(0);
    expect(rubberband(50, 300)).toBeGreaterThan(0);
    expect(rubberband(200, 300)).toBeGreaterThan(rubberband(50, 300));
    expect(rubberband(200, 300)).toBeLessThan(200);
  });
  it('approaches but never exceeds the dimension', () => {
    expect(rubberband(1e9, 300)).toBeLessThan(300);
  });
});
